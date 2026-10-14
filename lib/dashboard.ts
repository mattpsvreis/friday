import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  balanceSnapshots,
  creditCards,
  installments,
  ledgerEntries,
  purchases,
} from "@/db/schema";
import {
  calendarMonthWindow,
  inInclusiveRange,
  openCycleCloseDate,
  parseIsoDate,
  paymentDueForCycle,
  toIsoDate,
} from "@/lib/dates";
import {
  listEnabledRules,
  purgeAutoMaterializedLedger,
  sumRecurringCardOnOpenFatura,
  sumRecurringCardPaymentsDueInWindow,
  sumRecurringCashExpenses,
  sumRules,
} from "@/lib/recurring";

export type DashboardMonth = {
  year: number;
  /** 1–12 */
  month: number;
};

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

export async function getDashboardData(view: DashboardMonth, now = new Date()) {
  await purgeAutoMaterializedLedger();

  const monthIndex = view.month - 1;
  const { start, end } = calendarMonthWindow(view.year, monthIndex);
  const startIso = toIsoDate(start);
  const endIso = toIsoDate(end);

  const asOf =
    view.year === now.getUTCFullYear() && view.month === now.getUTCMonth() + 1
      ? now
      : end;

  const [snapshot] = await db.select().from(balanceSnapshots).limit(1);
  const spendable = snapshot?.spendableCents ?? 0;
  const saved = snapshot?.savedCents ?? 0;

  const enabledRules = await listEnabledRules();
  const recurringCash = sumRecurringCashExpenses(enabledRules);
  const recurringIncome = sumRules(enabledRules, "income");

  const confirmedLedger = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.status, "confirmed"),
        gte(ledgerEntries.occursOn, startIso),
        lte(ledgerEntries.occursOn, endIso),
      ),
    );

  const ledgerIncomes = confirmedLedger
    .filter((row) => row.direction === "income")
    .reduce((sum, row) => sum + row.amountCents, 0);

  const incomes = ledgerIncomes + recurringIncome;

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

  let installmentPaymentsDue = 0;
  let faturaPaymentsDue = 0;

  for (const card of cards) {
    const dueAmounts = new Map<string, number>();
    for (const row of confirmedInstallments) {
      const purchase = confirmedPurchases.find((p) => p.id === row.purchaseId);
      if (!purchase || purchase.creditCardId !== card.id) continue;
      const due = paymentDueForCycle(
        parseIsoDate(row.cycleCloseDate),
        card.paymentDueDay,
      );
      if (!inInclusiveRange(due, start, end)) continue;
      const key = toIsoDate(due);
      dueAmounts.set(key, (dueAmounts.get(key) ?? 0) + row.amountCents);
      installmentPaymentsDue += row.amountCents;
    }

    for (const amount of dueAmounts.values()) {
      faturaPaymentsDue += amount;
    }
  }

  const recurringCardDue = sumRecurringCardPaymentsDueInWindow(
    enabledRules,
    cardsById,
    start,
    end,
  );
  installmentPaymentsDue += recurringCardDue;
  faturaPaymentsDue += recurringCardDue;

  // Manual / imported ledger cash expenses only (recurring comes from rules).
  const oneTimeCash = confirmedLedger
    .filter(
      (row) =>
        row.direction === "expense" &&
        row.method !== "credit_card" &&
        row.method !== "card_payment",
    )
    .reduce((sum, row) => sum + row.amountCents, 0);

  const predictedTotal = oneTimeCash + recurringCash + installmentPaymentsDue;

  const expectedEnd =
    spendable + incomes - oneTimeCash - recurringCash - faturaPaymentsDue;

  const cardStats = cards.map((card) => {
    const openClose = openCycleCloseDate(asOf, card.cycleCloseDay);
    const remainingInstallments = confirmedInstallments
      .filter((row) => {
        const purchase = confirmedPurchases.find((p) => p.id === row.purchaseId);
        if (!purchase || purchase.creditCardId !== card.id) return false;
        const close = parseIsoDate(row.cycleCloseDate);
        return close.getTime() >= openClose.getTime();
      })
      .reduce((sum, row) => sum + row.amountCents, 0);

    const recurringOnLimit = sumRecurringCardOnOpenFatura(
      enabledRules,
      card,
      asOf,
    );

    const used = remainingInstallments + recurringOnLimit;
    return {
      id: card.id,
      label: card.label,
      bank: card.bank,
      last4: card.last4,
      limitCents: card.limitCents,
      usedCents: used,
      availableCents: card.limitCents - used,
      cycleCloseDay: card.cycleCloseDay,
      paymentDueDay: card.paymentDueDay,
    };
  });

  return {
    window: {
      start: startIso,
      end: endIso,
      year: view.year,
      month: view.month,
    },
    spendableCents: spendable,
    savedCents: saved,
    incomesCents: incomes,
    predicted: {
      totalCents: predictedTotal,
      oneTimeCashCents: oneTimeCash,
      recurringCashCents: recurringCash,
      installmentsCents: installmentPaymentsDue,
    },
    faturaPaymentsDueCents: faturaPaymentsDue,
    expectedEndCents: expectedEnd,
    cards: cardStats,
  };
}
