import { jsonOk, unauthorizedIfNeeded } from "@/lib/api";
import { ensureSettingsRow } from "@/lib/auth";

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const settings = await ensureSettingsRow();
  return jsonOk({
    hasPassword: Boolean(settings.passwordHash),
  });
}
