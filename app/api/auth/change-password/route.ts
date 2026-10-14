import { jsonError, jsonOk, readJson, unauthorizedIfNeeded } from "@/lib/api";
import { changePassword } from "@/lib/auth";

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson<{
      currentPassword?: string;
      newPassword?: string;
    }>(request);
    if (!body.currentPassword || !body.newPassword) {
      return jsonError("currentPassword and newPassword are required");
    }
    await changePassword(body.currentPassword, body.newPassword);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Change password failed",
      401,
    );
  }
}
