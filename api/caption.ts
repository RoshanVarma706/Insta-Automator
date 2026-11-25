/**
 * POST /api/caption
 *
 * Calls Gemini to analyze the video, identify viral moments with strong
 * start/end points matching the requested duration, and write captions + hashtags.
 *
 * Request:  { "url": "…", "source": "youtube"|"instagram"|"generic",
 *             "count": 1..5, "targetDuration": 30|45|60, "totalDuration"?: number }
 * Response: { "ok": true, "clips": ViralClip[] }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import { analyzeViralClips } from "./_lib/gemini.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed");
  }

  const body = parseBody(req.body);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const source =
    body.source === "youtube" || body.source === "instagram" || body.source === "twitch"
      ? body.source
      : "generic";
  const videoTitle =
    typeof body.videoTitle === "string" && body.videoTitle.trim()
      ? body.videoTitle.trim()
      : undefined;

  const count = Math.min(5, Math.max(1, Math.round(Number(body.count) || 1)));
  const targetDuration = Math.min(
    90,
    Math.max(15, Math.round(Number(body.targetDuration) || 30)),
  );
  const totalDuration =
    typeof body.totalDuration === "number" && body.totalDuration > 0
      ? body.totalDuration
      : undefined;
  const analysisUrl =
    typeof body.analysisUrl === "string" && body.analysisUrl.trim()
      ? body.analysisUrl.trim()
      : undefined;

  if (!url) return fail(res, 400, "A `url` field is required.");

  try {
    const clips = await analyzeViralClips({
      videoUrl: url,
      source,
      count,
      targetDuration,
      totalDuration,
      videoTitle,
      analysisUrl,
    });
    res.status(200).json({ ok: true, clips });
  } catch (err: unknown) {
    return fail(res, 500, errorMessage(err));
  }
}
