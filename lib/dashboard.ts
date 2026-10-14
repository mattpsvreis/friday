import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  balanceSnapshots,
  categories,
  creditCards,
  installments,
  ledgerEntries,
  purchases,
  recurringRules,
} from "@/db/schema";
import {
  calendarMonthWindow,
  clampDay,
  cycleCloseDateFor,
  dateWithDay,
  inInclusiveRange,
  parseIsoDate,
  faturaExpenseAttributionDate,
  shiftYearMonth,
  toIsoDate,
} from "@/lib/dates";
import { computeCardLimitUsages } from "@/lib/card-limits";
import {
  listAllRules,
  listEnabledRules,
  purgeAutoMaterializedLedger,
  sumRecurringCardPaymentsDueInWindow,
  sumRecurringCashExpenses,
  sumRules,
  type RecurringRuleRow,
} from "@/lib/recurring";

export type DashboardMonth = {
  year: number;
  /** 1–12 */
  month: number;
};

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string;
  cents: number;
};

export type MonthSeriesPoint = {
  year: number;
  month: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  byCategory: CategorySlice[];
};

const UNCATEGORIZED = {
  categoryId: null as string | null,
  name: "Uncategorized",
  color: "#6b7280",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function resolveDashboardMonth(
  input: Partial<DashboardMonth> | undefined,
  now = new Date(),
): DashboardMonth {
  const year = input?.year ?? now.getUTCFullYear();
  const month = input?.month ?? now.getUTCMonth() + 1;
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    throw new Error("Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }
  return { year, month };
}

type CardRow = typeof creditCards.$inferSelect;
type PurchaseRow = typeof purchases.$inferSelect;
type InstallmentRow = typeof installments.$inferSelect;
type LedgerRow = typeof ledgerEntries.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type RuleRow = typeof recurringRules.$inferSelect;

function addCategoryCents(
  map: Map<string, CategorySlice>,
  categoryId: string | null | undefined,
  cents: number,
  categoryById: Map<string, CategoryRow>,
) {
  if (cents === 0) return;
  const key = categoryId ?? "__none__";
  const existing = map.get(key);
  if (existing) {
    existing.cents += cents;
    return;
  }
  if (categoryId) {
    const cat = categoryById.get(categoryId);
    map.set(key, {
      categoryId,
      name: cat?.name ?? "Uncategorized",
      color: cat?.color ?? UNCATEGORIZED.color,
      cents,
    });
    return;
  }
  map.set(key, { ...UNCATEGORIZED, cents });
}

function monthMetrics(input: {
  year: number;
  month: number;
  enabledRules: RuleRow[];
  cards: CardRow[];
  cardsById: Map<string, CardRow>;
  confirmedPurchases: PurchaseRow[];
  confirmedInstallments: InstallmentRow[];
  allConfirmedLedger: LedgerRow[];
  categoryById: Map<string, CategoryRow>;
}) {
  const monthIndex = input.month - 1;
  const { start, end } = calendarMonthWindow(input.year, monthIndex);
  const startIso = toIsoDate(start);
  const endIso = toIsoDate(end);

  const ledgerInMonth = input.allConfirmedLedger.filter(
    (row) => row.occursOn >= startIso && row.occursOn <= endIso,
  );

  const ledgerIncomes = ledgerInMonth
    .filter((row) => row.direction === "income")
    .reduce((sum, row) => sum + row.amountCents, 0);

  const recurringIncome = sumRules(input.enabledRules, "income");
  const incomesCents = ledgerIncomes + recurringIncome;

  const recurringCash = sumRecurringCashExpenses(input.enabledRules);

  /**
   * Confirmed purchase parcels budgeted in this month.
   * Attribution is cycle-close − 1 (cut on the card close day, e.g. the 4th).
   */
  let purchaseInstallmentsDue = 0;
  const byCategory = new Map<string, CategorySlice>();

  for (const card of input.cards) {
    for (const row of input.confirmedInstallments) {
      const purchase = input.confirmedPurchases.find(
        (p) => p.id === row.purchaseId,
      );
      if (!purchase || purchase.creditCardId !== card.id) continue;
      const close = parseIsoDate(row.cycleCloseDate);
      const attributed = faturaExpenseAttributionDate(close);
      if (!inInclusiveRange(attributed, start, end)) continue;
      purchaseInstallmentsDue += row.amountCents;
      addCategoryCents(
        byCategory,
        purchase.categoryId,
        row.amountCents,
        input.categoryById,
      );
    }
  }

  /** Card recurring templates budgeted in this month (close − 1). */
  const recurringCardDue = sumRecurringCardPaymentsDueInWindow(
    input.enabledRules as RecurringRuleRow[],
    input.cardsById,
    start,
    end,
  );

  /**
   * One-shot credit-card ledger expenses budgeted by cycle close − 1
   * (cut on the 4th / card close day — not calendar month of occursOn).
   */
  const DEFAULT_CYCLE_CLOSE_DAY = 4;
  let ledgerCardDue = 0;
  for (const row of input.allConfirmedLedger) {
    if (row.direction !== "expense") continue;
    if (row.method !== "credit_card" && row.method !== "card_payment") {
      continue;
    }
    const card = row.creditCardId
      ? input.cardsById.get(row.creditCardId)
      : undefined;
    const close = cycleCloseDateFor(
      parseIsoDate(row.occursOn),
      card?.cycleCloseDay ?? DEFAULT_CYCLE_CLOSE_DAY,
    );
    const attributed = faturaExpenseAttributionDate(close);
    if (!inInclusiveRange(attributed, start, end)) continue;
    ledgerCardDue += row.amountCents;
    addCategoryCents(
      byCategory,
      row.categoryId,
      row.amountCents,
      input.categoryById,
    );
  }

  const faturaPaymentsDue =
    purchaseInstallmentsDue + recurringCardDue + ledgerCardDue;

  for (const rule of input.enabledRules) {
    if (rule.direction !== "expense") continue;
    if (rule.method === "credit_card" || rule.method === "card_payment") {
      const card = rule.creditCardId
        ? input.cardsById.get(rule.creditCardId)
        : undefined;
      if (!card) continue;
      let dueInWindow = false;
      // Nearby charge months cover close-day lag after close−1 attribution.
      for (const delta of [-1, 0, 1] as const) {
        const shifted = shiftYearMonth(input.year, monthIndex, delta);
        const charge = dateWithDay(
          shifted.year,
          shifted.monthIndex,
          clampDay(shifted.year, shifted.monthIndex, rule.dayOfMonth),
        );
        const close = cycleCloseDateFor(charge, card.cycleCloseDay);
        const attributed = faturaExpenseAttributionDate(close);
        if (inInclusiveRange(attributed, start, end)) {
          dueInWindow = true;
          break;
        }
      }
      if (dueInWindow) {
        addCategoryCents(
          byCategory,
          rule.categoryId,
          rule.amountCents,
          input.categoryById,
        );
      }
      continue;
    }
    addCategoryCents(
      byCategory,
      rule.categoryId,
      rule.amountCents,
      input.categoryById,
    );
  }

  const oneTimeCash = ledgerInMonth
    .filter(
      (row) =>
        row.direction === "expense" &&
        row.method !== "credit_card" &&
        row.method !== "card_payment",
    )
    .reduce((sum, row) => sum + row.amountCents, 0);

  for (const row of ledgerInMonth) {
    if (row.direction !== "expense") continue;
    if (row.method === "credit_card" || row.method === "card_payment") continue;
    addCategoryCents(
      byCategory,
      row.categoryId,
      row.amountCents,
      input.categoryById,
    );
  }

  const expenseCents = oneTimeCash + recurringCash + faturaPaymentsDue;

  return {
    start,
    end,
    startIso,
    endIso,
    incomesCents,
    oneTimeCashCents: oneTimeCash,
    recurringCashCents: recurringCash,
    recurringCardCents: recurringCardDue,
    /**
     * Card-cycle spend budgeted this month: purchase parcels + one-shot
     * credit-card ledger rows (excludes card recurring templates).
     */
    installmentsCents: purchaseInstallmentsDue + ledgerCardDue,
    faturaPaymentsDueCents: faturaPaymentsDue,
    expenseCents,
    byCategory: [...byCategory.values()].sort((a, b) => b.cents - a.cents),
  };
}

export async function getDashboardData(view: DashboardMonth, now = new Date()) {
  await purgeAutoMaterializedLedger();

  const [snapshot] = await db.select().from(balanceSnapshots).limit(1);
  const spendable = snapshot?.spendableCents ?? 0;
  const saved = snapshot?.savedCents ?? 0;

  const enabledRules = await listEnabledRules();
  const allRules = await listAllRules();
  const categoryRows = await db.select().from(categories);
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  const cards = await db.select().from(creditCards);
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  const confirmedPurchases = await db
    .select()
    .from(purchases)
    .where(eq(purchases.status, "confirmed"));
  const purchaseIds = new Set(confirmedPurchases.map((p) => p.id));
  const allInstallments = await db.select().from(installments);
  const confirmedInstallments = allInstallments.filter((row) =>
    purchaseIds.has(row.purchaseId),
  );

  const allConfirmedLedger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.status, "confirmed"));

  const shared = {
    enabledRules,
    cards,
    cardsById,
    confirmedPurchases,
    confirmedInstallments,
    allConfirmedLedger,
    categoryById,
  };

  const current = monthMetrics({
    year: view.year,
    month: view.month,
    ...shared,
  });

  const asOf =
    view.year === now.getUTCFullYear() && view.month === now.getUTCMonth() + 1
      ? now
      : current.end;

  const expectedEnd =
    spendable +
    current.incomesCents -
    current.oneTimeCashCents -
    current.recurringCashCents -
    current.faturaPaymentsDueCents;

  const cardStats = computeCardLimitUsages({
    cards,
    confirmedPurchases,
    confirmedInstallments,
    enabledRules,
    asOf,
  });

  const series: MonthSeriesPoint[] = [];
  for (let delta = -3; delta <= 3; delta++) {
    const shifted = shiftYearMonth(view.year, view.month - 1, delta);
    const point = monthMetrics({
      year: shifted.year,
      month: shifted.monthIndex + 1,
      ...shared,
    });
    const monthName =
      MONTH_LABELS[shifted.monthIndex] ?? String(shifted.monthIndex + 1);
    const yearShort = String(shifted.year).slice(-2);
    series.push({
      year: shifted.year,
      month: shifted.monthIndex + 1,
      label: `${monthName}/${yearShort}`,
      incomeCents: point.incomesCents,
      expenseCents: point.expenseCents,
      byCategory: point.byCategory,
    });
  }

  const installmentsByPurchase = new Map<string, typeof confirmedInstallments>();
  for (const row of confirmedInstallments) {
    const list = installmentsByPurchase.get(row.purchaseId) ?? [];
    list.push(row);
    installmentsByPurchase.set(row.purchaseId, list);
  }

  const recentLedger = [...allConfirmedLedger]
    .sort((a, b) => b.occursOn.localeCompare(a.occursOn))
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      kind: "ledger" as const,
      date: row.occursOn,
      name: row.description || row.method,
      direction: row.direction,
      method: row.method,
      amountCents: row.amountCents,
      perMonthCents: null as number | null,
      categoryId: row.categoryId,
      creditCardId: row.creditCardId,
    }));

  const recentPurchases = [...confirmedPurchases]
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    .slice(0, 12)
    .map((row) => {
      const parcels = installmentsByPurchase.get(row.id) ?? [];
      const firstParcel = parcels.find((p) => p.number === 1) ?? parcels[0];
      const perMonthCents =
        firstParcel?.amountCents ??
        (row.installmentCount > 0
          ? Math.round(row.totalCents / row.installmentCount)
          : row.totalCents);
      return {
        id: row.id,
        kind: "purchase" as const,
        date: row.purchaseDate,
        name: row.merchant,
        direction: "expense" as const,
        method: "credit_card",
        amountCents: row.totalCents,
        perMonthCents,
        categoryId: row.categoryId,
        creditCardId: row.creditCardId,
      };
    });

  const recentTransactions = [...recentLedger, ...recentPurchases]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 11)
    .map((row) => {
      const cat = row.categoryId ? categoryById.get(row.categoryId) : undefined;
      const card = row.creditCardId
        ? cardsById.get(row.creditCardId)
        : undefined;
      return {
        ...row,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        cardLabel: card?.label ?? null,
      };
    });

  const recurrings = [...allRules]
    .sort(
      (a, b) =>
        b.amountCents - a.amountCents || a.name.localeCompare(b.name),
    )
    .map((rule) => {
      const cat = rule.categoryId
        ? categoryById.get(rule.categoryId)
        : undefined;
      return {
        id: rule.id,
        name: rule.name,
        direction: rule.direction,
        amountCents: rule.amountCents,
        dayOfMonth: rule.dayOfMonth,
        enabled: rule.enabled,
        method: rule.method,
        categoryId: rule.categoryId,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
      };
    });

  return {
    window: {
      start: current.startIso,
      end: current.endIso,
      year: view.year,
      month: view.month,
    },
    spendableCents: spendable,
    savedCents: saved,
    incomesCents: current.incomesCents,
    expenseCents: current.expenseCents,
    predicted: {
      totalCents: current.expenseCents,
      oneTimeCashCents: current.oneTimeCashCents,
      // All ON templates due this month (cash + card) — card recurrings are
      // not purchase installments.
      recurringCashCents:
        current.recurringCashCents + current.recurringCardCents,
      installmentsCents: current.installmentsCents,
    },
    faturaPaymentsDueCents: current.faturaPaymentsDueCents,
    expectedEndCents: expectedEnd,
    byCategory: current.byCategory,
    series,
    recentTransactions,
    recurrings,
    cards: cardStats,
  };
}
