/**
 * GET /api/ig-user
 *
 * Uses the INSTAGRAM_ACCESS_TOKEN to resolve the linked Instagram
 * Business Account — returns the IG user ID, username, and page name.
 * The frontend calls this on load to show the connected account and
 * to auto-detect whether the real pipeline is available.
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { fail } from "./_lib/types.js";
import { getIgUserId } from "./_lib/instagram.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return fail(res, 405, "Method not allowed");
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return fail(res, 500, "INSTAGRAM_ACCESS_TOKEN is not configured.");
  }

  try {
    const info = await getIgUserId(accessToken);
    res.status(200).json({ ok: true, ...info });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
