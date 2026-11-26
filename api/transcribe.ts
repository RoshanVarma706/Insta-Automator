/**
 * POST /api/transcribe
 *
 * Extracts the exact MP3 audio snippet for [startSeconds..endSeconds] from
 * Cloudinary and runs Gemini verbatim speech transcription so burned-in
 * captions match the real spoken words and timing.
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import { buildClipAudioUrl, type CaptionStyle } from "./_lib/cloudinary.js";
import { transcribeClipAudio } from "./_lib/gemini.js";

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
  const startSeconds = Number(body.startSeconds ?? 0);
  const endSeconds = Number(body.endSeconds ?? 30);
  const captionStyle = parseCaptionStyle(body.captionStyle);

  if (!publicId) {
    return fail(res, 400, "A `publicId` field is required.");
  }
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    return fail(res, 400, "`startSeconds` and `endSeconds` must be numbers.");
  }

  const clipDuration = Math.max(3, Math.round(endSeconds) - Math.max(0, Math.round(startSeconds)));

  try {
    const audioUrl = buildClipAudioUrl(publicId, startSeconds, endSeconds);
    const result = await transcribeClipAudio(
      audioUrl,
      clipDuration,
      captionStyle,
    );
    return res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    return fail(res, 500, errorMessage(err));
  }
}
