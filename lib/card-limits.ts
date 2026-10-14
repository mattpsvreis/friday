import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditCards, installments, purchases } from "@/db/schema";
import { openCycleCloseDate, parseIsoDate } from "@/lib/dates";
import {
  listEnabledRules,
  sumRecurringCardOnOpenFatura,
} from "@/lib/recurring";

export type CardLimitUsage = {
  id: string;
  label: string;
  bank: string;
  last4: string;
  limitCents: number;
  usedCents: number;
  availableCents: number;
  cycleCloseDay: number;
  paymentDueDay: number;
};

/** Open-fatura usage: remaining installments + card recurrings on the open cycle. */
export function computeCardLimitUsages(input: {
  cards: Array<{
    id: string;
    label: string;
    bank: string;
    last4: string;
    limitCents: number;
    cycleCloseDay: number;
    paymentDueDay: number;
  }>;
  confirmedPurchases: Array<{ id: string; creditCardId: string }>;
  confirmedInstallments: Array<{
    purchaseId: string;
    amountCents: number;
    cycleCloseDate: string;
  }>;
  enabledRules: Parameters<typeof sumRecurringCardOnOpenFatura>[0];
  asOf?: Date;
}): CardLimitUsage[] {
  const asOf = input.asOf ?? new Date();

  return input.cards.map((card) => {
    const openClose = openCycleCloseDate(asOf, card.cycleCloseDay);
    const remainingInstallments = input.confirmedInstallments
      .filter((row) => {
        const purchase = input.confirmedPurchases.find(
          (p) => p.id === row.purchaseId,
        );
        if (!purchase || purchase.creditCardId !== card.id) return false;
        const close = parseIsoDate(row.cycleCloseDate);
        return close.getTime() >= openClose.getTime();
      })
      .reduce((sum, row) => sum + row.amountCents, 0);

    const recurringOnLimit = sumRecurringCardOnOpenFatura(
      input.enabledRules,
      card,
      asOf,
    );

    const usedCents = remainingInstallments + recurringOnLimit;
    return {
      id: card.id,
      label: card.label,
      bank: card.bank,
      last4: card.last4,
      limitCents: card.limitCents,
      usedCents,
      availableCents: card.limitCents - usedCents,
      cycleCloseDay: card.cycleCloseDay,
      paymentDueDay: card.paymentDueDay,
    };
  });
}

export async function loadCardLimitUsages(
  asOf = new Date(),
): Promise<CardLimitUsage[]> {
  const cards = await db.select().from(creditCards);
  const enabledRules = await listEnabledRules();
  const confirmedPurchases = await db
    .select()
    .from(purchases)
    .where(eq(purchases.status, "confirmed"));
  const purchaseIds = new Set(confirmedPurchases.map((p) => p.id));
  const allInstallments = await db.select().from(installments);
  const confirmedInstallments = allInstallments.filter((row) =>
    purchaseIds.has(row.purchaseId),
  );

  return computeCardLimitUsages({
    cards,
    confirmedPurchases,
    confirmedInstallments,
    enabledRules,
    asOf,
  });
}
