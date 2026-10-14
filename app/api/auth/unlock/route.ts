import { jsonError, jsonOk, readJson } from "@/lib/api";
import { unlock } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ password?: string }>(request);
    if (!body.password) return jsonError("Password required");
    const session = await unlock(body.password);
    return jsonOk(session);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unlock failed",
      401,
    );
  }
}
