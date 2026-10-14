import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditCards, installments, purchases } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";
import {
  cycleCloseDateFor,
  parseIsoDate,
  shiftCycleClose,
  toIsoDate,
} from "@/lib/dates";
import { buildInstallments } from "@/lib/purchases";

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    creditCardId?: string;
    merchant?: string;
    description?: string;
    purchaseDate?: string;
    installmentCount?: number;
    amountPerInstallmentCents?: number;
    currentNumber?: number;
    categoryId?: string | null;
    status?: "unconfirmed" | "confirmed";
  }>(request);

  const description = (body.description ?? body.merchant)?.trim();

  if (!body.creditCardId) return jsonError("creditCardId is required");
  if (!description) return jsonError("description is required");
  if (!body.purchaseDate) return jsonError("purchaseDate is required");
  if (typeof body.installmentCount !== "number") {
    return jsonError("installmentCount is required");
  }
  if (typeof body.amountPerInstallmentCents !== "number") {
    return jsonError("amountPerInstallmentCents is required");
  }

  const [card] = await db
    .select()
    .from(creditCards)
    .where(eq(creditCards.id, body.creditCardId));
  if (!card) return jsonError("Card not found", 404);

  const currentNumber = body.currentNumber ?? 1;
  if (currentNumber < 1 || currentNumber > body.installmentCount) {
    return jsonError("currentNumber must be between 1 and installmentCount");
  }

  const firstClose = cycleCloseDateFor(
    parseIsoDate(body.purchaseDate),
    card.cycleCloseDay,
  );
  const currentCycleCloseIso = toIsoDate(
    shiftCycleClose(firstClose, currentNumber - 1),
  );

  const built = buildInstallments({
    installmentCount: body.installmentCount,
    amountPerInstallmentCents: body.amountPerInstallmentCents,
    currentNumber,
    currentCycleCloseIso,
  });

  const status = body.status ?? "confirmed";

  const result = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        creditCardId: body.creditCardId!,
        merchant: description,
        purchaseDate: body.purchaseDate!,
        totalCents: built.totalCents,
        installmentCount: body.installmentCount!,
        categoryId: body.categoryId ?? null,
        status,
      })
      .returning();

    const installmentRows = await tx
      .insert(installments)
      .values(
        built.installments.map((row) => ({
          purchaseId: purchase.id,
          number: row.number,
          ofTotal: row.ofTotal,
          amountCents: row.amountCents,
          cycleCloseDate: row.cycleCloseDate,
        })),
      )
      .returning();

    return { purchase, installments: installmentRows };
  });

  return jsonOk(result);
}
