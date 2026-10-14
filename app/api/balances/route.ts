import { eq } from "drizzle-orm";
import { db } from "@/db";
import { balanceSnapshots } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

async function ensureSnapshot() {
  const [existing] = await db.select().from(balanceSnapshots).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(balanceSnapshots)
    .values({ spendableCents: 0, savedCents: 0 })
    .returning();
  return created;
}

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const snapshot = await ensureSnapshot();
  return jsonOk(snapshot);
}

export async function PUT(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    spendableCents?: number;
    savedCents?: number;
  }>(request);

  if (
    typeof body.spendableCents !== "number" ||
    typeof body.savedCents !== "number"
  ) {
    return jsonError("spendableCents and savedCents are required numbers");
  }

  const [existing] = await db.select().from(balanceSnapshots).limit(1);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(balanceSnapshots)
      .set({
        spendableCents: body.spendableCents,
        savedCents: body.savedCents,
        updatedAt: now,
      })
      .where(eq(balanceSnapshots.id, existing.id))
      .returning();
    return jsonOk(updated);
  }

  const [created] = await db
    .insert(balanceSnapshots)
    .values({
      spendableCents: body.spendableCents,
      savedCents: body.savedCents,
    })
    .returning();
  return jsonOk(created);
}
