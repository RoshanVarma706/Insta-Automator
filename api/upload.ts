/**
 * POST /api/upload
 *
 * Uploads a video from a public URL to Cloudinary and eagerly
 * renders a 1080×1920 (9:16) vertical version for Instagram Reels.
 *
 * Request:  { "url": "https://…/video.mp4" }
 * Response: { "ok": true, "publicId": "…", "reframedUrl": "…", … }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { parseBody, fail } from "./_lib/types";
import { uploadAndReframe } from "./_lib/cloudinary";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed");
  }

  const body = parseBody(req.body);
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) return fail(res, 400, "A `url` field is required.");

  try {
    new URL(url);
  } catch {
    return fail(res, 400, "`url` must be a valid http(s) link.");
  }

  try {
    const result = await uploadAndReframe(url);
    res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
