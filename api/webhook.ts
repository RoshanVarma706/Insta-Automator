/**
 * Vercel serverless function — full live pipeline webhook.
 *
 * POST /api/webhook
 *   { "url": "…", "source": "youtube"|"instagram"|"generic",
 *     "count"?: 1..5, "targetDuration"?: 30|45|60 }
 *
 * Runs the real multi-clip pipeline:
 *   1. Upload source video to Cloudinary
 *   2. Identify viral clips + strong start/end points via Gemini
 *   3. Clip & 9:16 reframe each segment in Cloudinary
 *   4. Create Instagram Reels container & publish via Meta Graph API
 *
 * GET /api/webhook -> health check
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import { analyzeViralClips, transcribeClipAudio } from "./_lib/gemini.js";
import {
  buildClipAudioUrl,
  uploadSourceVideo,
  renderClippedReel,
  type AspectMode,
  type CaptionStyle,
} from "./_lib/cloudinary.js";
import {
  getIgUserId,
  createReelContainer,
  checkContainerStatus,
  publishReel,
} from "./_lib/instagram.js";

type Source = "youtube" | "instagram" | "generic";

const STEPS = [
  "Fetch & upload source video",
  "Gemini viral clip detection",
  "Clip & reframe to 9:16",
];

function isSource(value: unknown): value is Source {
  return value === "youtube" || value === "instagram" || value === "generic";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  const hasClippingKeys = !!(
    process.env.GEMINI_API_KEY && process.env.CLOUDINARY_URL
  );
  const hasIgKey = !!process.env.INSTAGRAM_ACCESS_TOKEN;

  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      mode: "live",
      configured: hasClippingKeys,
      igConfigured: hasIgKey,
      steps: STEPS,
      message: hasClippingKeys
        ? "Clipping pipeline is ready. POST a url to start."
        : "Missing required API keys (GEMINI_API_KEY, CLOUDINARY_URL).",
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, 405, "Method not allowed");
  }

  if (!hasClippingKeys) {
    return fail(
      res,
      500,
      "Missing server API keys (GEMINI_API_KEY, CLOUDINARY_URL).",
    );
  }

  const body = parseBody(req.body ?? req.query);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const source: Source = isSource(body.source) ? body.source : "generic";
  const count = Math.min(5, Math.max(1, Math.round(Number(body.count) || 1)));
  const targetDuration = Math.min(
    90,
    Math.max(15, Math.round(Number(body.targetDuration) || 30)),
  );
  const aspectMode: AspectMode =
    body.aspectMode === "16:9" || body.aspectMode === "9:16-16:9"
      ? body.aspectMode
      : "9:16";

  if (!url) return fail(res, 400, "A `url` field is required.");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return fail(res, 400, "`url` must be a valid http(s) link.");
  }

  try {
    const uploaded = await uploadSourceVideo(url);
    const viralClips = await analyzeViralClips({
      videoUrl: url,
      source,
      count,
      targetDuration,
      totalDuration: uploaded.duration,
    });

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const { igUserId } = await getIgUserId(accessToken);

    const captionsEnabled = body.captionsEnabled !== false;
    const captionStyle: CaptionStyle =
      body.captionStyle === "clean" ||
      body.captionStyle === "neon" ||
      body.captionStyle === "cinema"
        ? body.captionStyle
        : "viral";
    const results = [];
    for (const clip of viralClips) {
      const transcribed = captionsEnabled
        ? await transcribeClipAudio(
            buildClipAudioUrl(uploaded.publicId, clip.startSeconds, clip.endSeconds),
            Math.max(3, clip.endSeconds - clip.startSeconds),
            captionStyle,
          )
        : { subtitles: [] };
      const title = transcribed.title || clip.title;
      const captionText = transcribed.caption || clip.caption;
      const hashtags = transcribed.hashtags || clip.hashtags;
      const rendered = await renderClippedReel(
        uploaded.publicId,
        clip.startSeconds,
        clip.endSeconds,
        {
          aspectMode,
          captionsEnabled,
          captionStyle,
          hookTitle: title,
          subtitles: transcribed.subtitles,
        },
      );
      const fullCaption = `${captionText}\n\n${hashtags.join(" ")}`;
      const containerId = await createReelContainer(
        igUserId,
        rendered.clipUrl,
        fullCaption,
        accessToken,
      );

      let mediaId = "";
      let publishStatus = "processing";
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        const check = await checkContainerStatus(containerId, accessToken);
        if (check.statusCode === "ERROR") {
          throw new Error(check.errorMessage || "Container processing failed.");
        }
        if (check.statusCode === "FINISHED") {
          mediaId = await publishReel(igUserId, containerId, accessToken);
          publishStatus = "published";
          break;
        }
      }

      results.push({
        title,
        startSeconds: rendered.startSeconds,
        endSeconds: rendered.endSeconds,
        durationSeconds: rendered.durationSeconds,
        hookReason: clip.hookReason,
        caption: captionText,
        hashtags,
        cloudinaryUrl: rendered.clipUrl,
        containerId,
        mediaId: mediaId || null,
        status: publishStatus,
        format: rendered.format,
      });
    }

    res.status(200).json({
      ok: true,
      mode: "live",
      source,
      url,
      steps: STEPS,
      results,
    });
  } catch (err: unknown) {
    return fail(res, 500, errorMessage(err));
  }
}
