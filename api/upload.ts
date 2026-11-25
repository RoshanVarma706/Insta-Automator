/**
 * POST /api/upload
 *
 * Two modes:
 *  1. Source upload: { "url": "https://…" }
 *     Uploads the source video (YouTube or direct MP4) to Cloudinary and
 *     returns { publicId, originalUrl, duration, bytes }.
 *
 *  2. Clip & 9:16 render: { "publicId": "…", "startSeconds": 12, "endSeconds": 42 }
 *     Clips the exact viral segment and reframes it to 1080×1920 MP4.
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import {
  uploadSourceVideo,
  renderClippedReel,
  type AspectMode,
} from "./_lib/cloudinary.js";

function parseAspectMode(val: unknown): AspectMode {
  if (val === "16:9" || val === "9:16-16:9") return val;
  return "9:16";
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed");
  }

  const body = parseBody(req.body);
  const publicId =
    typeof body.publicId === "string" ? body.publicId.trim() : "";

  // Mode 2: Clip + reframe an already-uploaded source video
  if (publicId) {
    const startSeconds = Number(body.startSeconds ?? 0);
    const endSeconds = Number(body.endSeconds ?? 30);
    const aspectMode = parseAspectMode(body.aspectMode);

    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      return fail(res, 400, "`startSeconds` and `endSeconds` must be numbers.");
    }

    try {
      const clipped = await renderClippedReel(
        publicId,
        startSeconds,
        endSeconds,
        aspectMode,
      );
      return res.status(200).json({ ok: true, ...clipped });
    } catch (err: unknown) {
      return fail(res, 500, errorMessage(err));
    }
  }

  // Mode 1: Upload source video
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return fail(res, 400, "A `url` or `publicId` field is required.");

  try {
    new URL(url);
  } catch {
    return fail(res, 400, "`url` must be a valid http(s) link.");
  }

  try {
    const result = await uploadSourceVideo(url);
    res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    return fail(res, 500, errorMessage(err));
  }
}
