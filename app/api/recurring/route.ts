import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recurringRules } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

type RecurringBody = {
  id?: string;
  name?: string;
  direction?: "income" | "expense";
  amountCents?: number;
  dayOfMonth?: number;
  enabled?: boolean;
  method?: (typeof recurringRules.$inferInsert)["method"];
  categoryId?: string | null;
  creditCardId?: string | null;
};

function recurringInsertValues(body: RecurringBody) {
  if (!body.name?.trim()) return { error: "name is required" as const };
  if (body.direction !== "income" && body.direction !== "expense") {
    return { error: "direction must be income or expense" as const };
  }
  if (typeof body.amountCents !== "number") {
    return { error: "amountCents is required" as const };
  }
  if (typeof body.dayOfMonth !== "number") {
    return { error: "dayOfMonth is required" as const };
  }

  return {
    values: {
      name: body.name.trim(),
      direction: body.direction,
      amountCents: body.amountCents,
      dayOfMonth: body.dayOfMonth,
      enabled: body.enabled ?? true,
      method: body.method ?? "other",
      categoryId: body.categoryId ?? null,
      creditCardId: body.creditCardId ?? null,
    },
  };
}

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(recurringRules);
  return jsonOk(rows);
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<RecurringBody>(request);
  const parsed = recurringInsertValues(body);
  if ("error" in parsed) return jsonError(String(parsed.error));

  const [created] = await db
    .insert(recurringRules)
    .values(parsed.values)
    .returning();

  return jsonOk(created);
}

export async function PUT(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<RecurringBody>(request);
  if (!body.id) return jsonError("id is required");

  const patch: Partial<typeof recurringRules.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.direction !== undefined) patch.direction = body.direction;
  if (body.amountCents !== undefined) patch.amountCents = body.amountCents;
  if (body.dayOfMonth !== undefined) patch.dayOfMonth = body.dayOfMonth;
  if (body.enabled !== undefined) patch.enabled = body.enabled;
  if (body.method !== undefined) patch.method = body.method;
  if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
  if (body.creditCardId !== undefined) patch.creditCardId = body.creditCardId;

  const [updated] = await db
    .update(recurringRules)
    .set(patch)
    .where(eq(recurringRules.id, body.id))
    .returning();

  if (!updated) return jsonError("Rule not found", 404);
  return jsonOk(updated);
}

export async function DELETE(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("id query parameter is required");

  await db.delete(recurringRules).where(eq(recurringRules.id, id));
  return jsonOk({ ok: true });
}
