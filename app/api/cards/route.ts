import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditCards } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

type CardBody = {
  id?: string;
  label?: string;
  bank?: string;
  last4?: string;
  limitCents?: number;
  cycleCloseDay?: number;
  paymentDueDay?: number;
};

function cardFields(body: CardBody, requireLabel: boolean) {
  if (requireLabel && !body.label?.trim()) {
    return { error: "label is required" as const };
  }
  if (
    body.limitCents !== undefined &&
    typeof body.limitCents !== "number"
  ) {
    return { error: "limitCents must be a number" as const };
  }
  if (
    body.cycleCloseDay !== undefined &&
    typeof body.cycleCloseDay !== "number"
  ) {
    return { error: "cycleCloseDay must be a number" as const };
  }
  if (
    body.paymentDueDay !== undefined &&
    typeof body.paymentDueDay !== "number"
  ) {
    return { error: "paymentDueDay must be a number" as const };
  }
  return {
    values: {
      label: body.label!.trim(),
      bank: body.bank ?? "",
      last4: body.last4 ?? "",
      limitCents: body.limitCents ?? 0,
      cycleCloseDay: body.cycleCloseDay ?? 4,
      paymentDueDay: body.paymentDueDay ?? 11,
    },
  };
}

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(creditCards);
  return jsonOk(rows);
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<CardBody>(request);
  const parsed = cardFields(body, true);
  if ("error" in parsed) return jsonError(String(parsed.error));

  const [created] = await db
    .insert(creditCards)
    .values(parsed.values)
    .returning();
  return jsonOk(created);
}

export async function PUT(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<CardBody>(request);
  if (!body.id) return jsonError("id is required");
  const cardId = body.id;
  const parsed = cardFields(body, true);
  if ("error" in parsed) return jsonError(String(parsed.error));

  const [updated] = await db
    .update(creditCards)
    .set(parsed.values)
    .where(eq(creditCards.id, cardId))
    .returning();
  if (!updated) return jsonError("Card not found", 404);
  return jsonOk(updated);
}

export async function DELETE(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("id query parameter is required");

  await db.delete(creditCards).where(eq(creditCards.id, id));
  return jsonOk({ ok: true });
}
