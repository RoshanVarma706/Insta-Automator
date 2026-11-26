/**
 * POST /api/upload
 *
 * Two modes:
 *  1. Source upload: { "url": "https://…" }
 *     First checks Supabase & Cloudinary for an existing downloaded source
 *     matching `url` so re-pasting the same link reuses the video instantly.
 *     Otherwise downloads & uploads to Cloudinary and saves metadata.
 *
 *  2. Clip & format render: { "publicId": "…", "startSeconds": 12, "endSeconds": 42, ... }
 *     Clips the exact viral segment, formats it, and burns optional captions.
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import {
  findExistingCloudinarySource,
  normalizeSourceUrl,
  uploadSourceVideo,
  renderClippedReel,
  type AspectMode,
  type CaptionStyle,
  type SubtitleCueInput,
} from "./_lib/cloudinary.js";
import { findSourceByUrl, upsertSource } from "./_lib/supabase.js";

function parseAspectMode(val: unknown): AspectMode {
  if (val === "16:9" || val === "9:16-16:9") return val;
  return "9:16";
}

function parseCaptionStyle(val: unknown): CaptionStyle {
  if (val === "clean" || val === "neon" || val === "cinema") return val;
  return "viral";
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
    const captionStyle = parseCaptionStyle(body.captionStyle);
    const captionsEnabled = body.captionsEnabled !== false;
    const hookTitle =
      typeof body.hookTitle === "string" ? body.hookTitle.trim() : undefined;
    const clipIndex =
      typeof body.clipIndex === "number" ? body.clipIndex : undefined;
    const subtitles = Array.isArray(body.subtitles)
      ? (body.subtitles as SubtitleCueInput[])
      : undefined;

    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      return fail(res, 400, "`startSeconds` and `endSeconds` must be numbers.");
    }

    try {
      const clipped = await renderClippedReel(
        publicId,
        startSeconds,
        endSeconds,
        {
          aspectMode,
          captionsEnabled,
          captionStyle,
          hookTitle,
          subtitles,
          clipIndex,
        },
      );
      return res.status(200).json({ ok: true, ...clipped });
    } catch (err: unknown) {
      return fail(res, 500, errorMessage(err));
    }
  }

  // Mode 1: Check cache first, then upload source video if needed
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return fail(res, 400, "A `url` or `publicId` field is required.");

  try {
    new URL(url);
  } catch {
    return fail(res, 400, "`url` must be a valid http(s) link.");
  }

  const normalizedUrl = normalizeSourceUrl(url);
  const forceReupload = body.forceReupload === true;

  try {
    if (!forceReupload) {
      // 1a. Check Supabase sources cache
      const sbCached = await findSourceByUrl(normalizedUrl);
      if (sbCached) {
        return res.status(200).json({
          ok: true,
          cached: true,
          publicId: sbCached.public_id,
          originalUrl: sbCached.original_url,
          analysisUrl: sbCached.analysis_url || sbCached.original_url,
          duration: sbCached.duration,
          bytes: sbCached.bytes,
          title: sbCached.title || undefined,
        });
      }

      // 1b. Check Cloudinary sources context cache
      const cldCached = await findExistingCloudinarySource(normalizedUrl);
      if (cldCached) {
        await upsertSource({
          source_url: normalizedUrl,
          public_id: cldCached.publicId,
          original_url: cldCached.originalUrl,
          analysis_url: cldCached.analysisUrl,
          title: cldCached.title ?? null,
          duration: cldCached.duration,
          bytes: cldCached.bytes,
        });
        return res.status(200).json({ ok: true, ...cldCached, cached: true });
      }
    }

    // 2. Not cached yet: download & upload to Cloudinary
    const result = await uploadSourceVideo(url);
    await upsertSource({
      source_url: normalizedUrl,
      public_id: result.publicId,
      original_url: result.originalUrl,
      analysis_url: result.analysisUrl,
      title: result.title ?? null,
      duration: result.duration,
      bytes: result.bytes,
    });

    res.status(200).json({ ok: true, cached: false, ...result });
  } catch (err: unknown) {
    return fail(res, 500, errorMessage(err));
  }
}
