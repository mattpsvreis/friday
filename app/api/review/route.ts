import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { installments, ledgerEntries, purchases } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const unconfirmedPurchases = await db
    .select()
    .from(purchases)
    .where(eq(purchases.status, "unconfirmed"));

  const purchaseIds = unconfirmedPurchases.map((p) => p.id);
  const purchaseInstallments =
    purchaseIds.length > 0
      ? await db
          .select()
          .from(installments)
          .where(inArray(installments.purchaseId, purchaseIds))
      : [];

  const installmentsByPurchase = new Map<string, typeof purchaseInstallments>();
  for (const row of purchaseInstallments) {
    const list = installmentsByPurchase.get(row.purchaseId) ?? [];
    list.push(row);
    installmentsByPurchase.set(row.purchaseId, list);
  }

  const purchasesWithInstallments = unconfirmedPurchases.map((p) => ({
    ...p,
    installments: installmentsByPurchase.get(p.id) ?? [],
  }));

  const unconfirmedLedger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.status, "unconfirmed"));

  return jsonOk({
    purchases: purchasesWithInstallments,
    ledgerEntries: unconfirmedLedger,
  });
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    action?: "confirm" | "reject";
    type?: "purchase" | "ledger";
    id?: string;
  }>(request);

  if (body.action !== "confirm" && body.action !== "reject") {
    return jsonError("action must be confirm or reject");
  }
  if (body.type !== "purchase" && body.type !== "ledger") {
    return jsonError("type must be purchase or ledger");
  }
  if (!body.id) return jsonError("id is required");

  if (body.type === "purchase") {
    if (body.action === "confirm") {
      const [updated] = await db
        .update(purchases)
        .set({ status: "confirmed" })
        .where(eq(purchases.id, body.id))
        .returning();
      if (!updated) return jsonError("Purchase not found", 404);
      return jsonOk(updated);
    }
    await db.delete(purchases).where(eq(purchases.id, body.id));
    return jsonOk({ ok: true });
  }

  if (body.action === "confirm") {
    const [updated] = await db
      .update(ledgerEntries)
      .set({ status: "confirmed" })
      .where(eq(ledgerEntries.id, body.id))
      .returning();
    if (!updated) return jsonError("Ledger entry not found", 404);
    return jsonOk(updated);
  }

  await db.delete(ledgerEntries).where(eq(ledgerEntries.id, body.id));
  return jsonOk({ ok: true });
}
