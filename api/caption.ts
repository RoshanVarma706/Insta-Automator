/**
 * POST /api/caption
 *
 * Calls the Gemini API to generate a scroll-stopping caption and
 * relevant hashtags for the given video URL.
 *
 * Request:  { "url": "…", "source": "youtube" | "instagram" | "generic" }
 * Response: { "ok": true, "caption": "…", "hashtags": ["#…", …] }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { parseBody, fail } from "./_lib/types";
import { generateCaption } from "./_lib/gemini";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed");
  }

  const body = parseBody(req.body);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const source =
    body.source === "youtube" || body.source === "instagram"
      ? body.source
      : "generic";

  if (!url) return fail(res, 400, "A `url` field is required.");

  try {
    const result = await generateCaption(url, source);
    res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
