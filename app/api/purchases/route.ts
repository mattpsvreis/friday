import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditCards, installments, purchases } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";
import { cycleCloseDateFor, parseIsoDate, toIsoDate } from "@/lib/dates";
import { buildInstallments } from "@/lib/purchases";

type PurchaseBody = {
  id?: string;
  creditCardId?: string;
  merchant?: string;
  description?: string;
  purchaseDate?: string;
  installmentCount?: number;
  totalCents?: number;
  categoryId?: string | null;
};

type ParsedPurchase =
  | { ok: false; error: string }
  | {
      ok: true;
      creditCardId: string;
      description: string;
      purchaseDate: string;
      installmentCount: number;
      totalCents: number;
      categoryId: string | null;
    };

function parsePurchaseInput(body: PurchaseBody): ParsedPurchase {
  const description = (body.description ?? body.merchant)?.trim();

  if (!body.creditCardId) return { ok: false, error: "creditCardId is required" };
  if (!description) return { ok: false, error: "description is required" };
  if (!body.purchaseDate) return { ok: false, error: "purchaseDate is required" };
  if (typeof body.installmentCount !== "number") {
    return { ok: false, error: "installmentCount is required" };
  }
  if (body.installmentCount < 1) {
    return { ok: false, error: "installmentCount must be at least 1" };
  }
  if (typeof body.totalCents !== "number") {
    return { ok: false, error: "totalCents is required" };
  }

  return {
    ok: true,
    creditCardId: body.creditCardId,
    description,
    purchaseDate: body.purchaseDate,
    installmentCount: body.installmentCount,
    totalCents: body.totalCents,
    categoryId: body.categoryId ?? null,
  };
}

async function buildPurchaseSchedule(input: {
  creditCardId: string;
  purchaseDate: string;
  installmentCount: number;
  totalCents: number;
}) {
  const [card] = await db
    .select()
    .from(creditCards)
    .where(eq(creditCards.id, input.creditCardId));
  if (!card) {
    return { ok: false as const, error: "Card not found", status: 404 };
  }

  const firstCycleCloseIso = toIsoDate(
    cycleCloseDateFor(parseIsoDate(input.purchaseDate), card.cycleCloseDay),
  );

  const built = buildInstallments({
    installmentCount: input.installmentCount,
    totalCents: input.totalCents,
    currentNumber: 1,
    currentCycleCloseIso: firstCycleCloseIso,
  });

  return { ok: true as const, built };
}

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(purchases).orderBy(asc(purchases.purchaseDate));
  const allInstallments = await db.select().from(installments);
  const byPurchase = new Map<string, typeof allInstallments>();
  for (const row of allInstallments) {
    const list = byPurchase.get(row.purchaseId) ?? [];
    list.push(row);
    byPurchase.set(row.purchaseId, list);
  }

  return jsonOk(
    rows.map((purchase) => {
      const parcels = (byPurchase.get(purchase.id) ?? []).sort(
        (a, b) => a.number - b.number,
      );
      return {
        ...purchase,
        installments: parcels,
      };
    }),
  );
}

export async function DELETE(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("id query parameter is required");

  await db.delete(purchases).where(eq(purchases.id, id));
  return jsonOk({ ok: true });
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<PurchaseBody>(request);
  const parsed = parsePurchaseInput(body);
  if (!parsed.ok) return jsonError(parsed.error);

  const scheduled = await buildPurchaseSchedule(parsed);
  if (!scheduled.ok) {
    return jsonError(scheduled.error, scheduled.status);
  }

  const result = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        creditCardId: parsed.creditCardId,
        merchant: parsed.description,
        purchaseDate: parsed.purchaseDate,
        totalCents: scheduled.built.totalCents,
        installmentCount: parsed.installmentCount,
        categoryId: parsed.categoryId,
        status: "confirmed",
      })
      .returning();

    const installmentRows = await tx
      .insert(installments)
      .values(
        scheduled.built.installments.map((row) => ({
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

export async function PUT(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<PurchaseBody>(request);
  if (!body.id) return jsonError("id is required");

  const parsed = parsePurchaseInput(body);
  if (!parsed.ok) return jsonError(parsed.error);

  const scheduled = await buildPurchaseSchedule(parsed);
  if (!scheduled.ok) {
    return jsonError(scheduled.error, scheduled.status);
  }

  const purchaseId = body.id;

  const result = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .update(purchases)
      .set({
        creditCardId: parsed.creditCardId,
        merchant: parsed.description,
        purchaseDate: parsed.purchaseDate,
        totalCents: scheduled.built.totalCents,
        installmentCount: parsed.installmentCount,
        categoryId: parsed.categoryId,
      })
      .where(eq(purchases.id, purchaseId))
      .returning();

    if (!purchase) return null;

    await tx.delete(installments).where(eq(installments.purchaseId, purchaseId));

    const installmentRows = await tx
      .insert(installments)
      .values(
        scheduled.built.installments.map((row) => ({
          purchaseId,
          number: row.number,
          ofTotal: row.ofTotal,
          amountCents: row.amountCents,
          cycleCloseDate: row.cycleCloseDate,
        })),
      )
      .returning();

    return { purchase, installments: installmentRows };
  });

  if (!result) return jsonError("Purchase not found", 404);
  return jsonOk(result);
}
