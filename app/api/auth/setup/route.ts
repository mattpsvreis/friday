import { jsonError, jsonOk, readJson } from "@/lib/api";
import { setupPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ password?: string }>(request);
    if (!body.password || body.password.length < 4) {
      return jsonError("Password must be at least 4 characters");
    }
    const session = await setupPassword(body.password);
    return jsonOk(session);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Setup failed",
      400,
    );
  }
}
