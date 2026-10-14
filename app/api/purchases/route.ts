import { db } from "@/db";
import { installments, purchases } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";
import { buildInstallments } from "@/lib/purchases";

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    creditCardId?: string;
    merchant?: string;
    purchaseDate?: string;
    installmentCount?: number;
    amountPerInstallmentCents?: number;
    currentNumber?: number;
    currentCycleCloseDate?: string;
    categoryId?: string | null;
    status?: "unconfirmed" | "confirmed";
  }>(request);

  if (!body.creditCardId) return jsonError("creditCardId is required");
  if (!body.merchant?.trim()) return jsonError("merchant is required");
  if (!body.purchaseDate) return jsonError("purchaseDate is required");
  if (typeof body.installmentCount !== "number") {
    return jsonError("installmentCount is required");
  }
  if (typeof body.amountPerInstallmentCents !== "number") {
    return jsonError("amountPerInstallmentCents is required");
  }
  if (!body.currentCycleCloseDate) {
    return jsonError("currentCycleCloseDate is required");
  }

  const currentNumber = body.currentNumber ?? 1;
  const built = buildInstallments({
    installmentCount: body.installmentCount,
    amountPerInstallmentCents: body.amountPerInstallmentCents,
    currentNumber,
    currentCycleCloseIso: body.currentCycleCloseDate,
  });

  const status = body.status ?? "confirmed";

  const result = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        creditCardId: body.creditCardId!,
        merchant: body.merchant!.trim(),
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
