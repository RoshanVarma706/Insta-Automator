/**
 * Vercel serverless function — full pipeline webhook.
 *
 * POST /api/webhook  { "url": "…", "source": "youtube"|"instagram"|"generic" }
 *
 * Runs the complete pipeline in a single request:
 *   1. Generate caption + hashtags  (Gemini)
 *   2. Upload + 9:16 reframe        (Cloudinary)
 *   3. Create container + publish    (Meta Graph API)
 *
 * Also works as a health check:
 * GET /api/webhook → { ok, mode: "live"|"mock", steps }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { parseBody, fail } from "./_lib/types";
import { generateCaption } from "./_lib/gemini";
import { uploadAndReframe } from "./_lib/cloudinary";
import {
  getIgUserId,
  createReelContainer,
  checkContainerStatus,
  publishReel,
} from "./_lib/instagram";

type Source = "youtube" | "instagram" | "generic";

const STEPS = [
  "Detect source & fetch video",
  "Write caption & hashtags",
  "Reframe to 9:16",
  "Create Instagram media",
  "Publish to Reels",
];

function isSource(value: unknown): value is Source {
  return value === "youtube" || value === "instagram" || value === "generic";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  // ── Health check ───────────────────────────────────────────────
  if (req.method === "GET") {
    const hasKeys = !!(
      process.env.GEMINI_API_KEY &&
      process.env.CLOUDINARY_URL &&
      process.env.INSTAGRAM_ACCESS_TOKEN
    );

    res.status(200).json({
      ok: true,
      mode: hasKeys ? "live" : "mock",
      steps: STEPS,
      message: hasKeys
        ? "Pipeline is live. POST a url to start."
        : "Running in mock mode — add API keys to go live.",
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, 405, "Method not allowed");
  }

  // ── Parse input ────────────────────────────────────────────────
  const body = parseBody(req.body ?? req.query);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const source: Source = isSource(body.source) ? body.source : "generic";

  if (!url) return fail(res, 400, "A `url` field is required.");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return fail(res, 400, "`url` must be a valid http(s) link.");
  }

  // ── Check if real keys are present ─────────────────────────────
  const hasKeys = !!(
    process.env.GEMINI_API_KEY &&
    process.env.CLOUDINARY_URL &&
    process.env.INSTAGRAM_ACCESS_TOKEN
  );

  if (!hasKeys) {
    // Fall back to the original mock response.
    const now = Date.now();
    res.status(200).json({
      ok: true,
      mode: "mock",
      source,
      url,
      steps: STEPS,
      result: {
        id: `clip_${now.toString(36)}`,
        caption: "Mock caption — replace this with the Gemini response.",
        hashtags: ["#reels", "#viral", "#fyp", "#trending", "#instagood"],
        cloudinaryUrl: `https://res.cloudinary.com/demo/video/upload/c_fill,w_1080,h_1920/sample_${now}.mp4`,
        mediaId: `ig_${Math.floor(now / 1000)}`,
        format: "1080x1920",
      },
    });
    return;
  }

  // ── Real pipeline ──────────────────────────────────────────────

  try {
    // Step 1 — Caption & hashtags
    const caption = await generateCaption(url, source);

    // Step 2 — Cloudinary upload + 9:16 reframe
    const upload = await uploadAndReframe(url);

    // Step 3 — Create Instagram Reels container
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const { igUserId } = await getIgUserId(accessToken);
    const fullCaption = `${caption.caption}\n\n${caption.hashtags.join(" ")}`;
    const containerId = await createReelContainer(
      igUserId,
      upload.reframedUrl,
      fullCaption,
      accessToken,
    );

    // Step 4 — Poll for readiness + publish
    let mediaId = "";
    let publishStatus = "processing";

    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const check = await checkContainerStatus(containerId, accessToken);

      if (check.statusCode === "ERROR") {
        throw new Error(
          check.errorMessage || "Container processing failed.",
        );
      }
      if (check.statusCode === "FINISHED") {
        mediaId = await publishReel(igUserId, containerId, accessToken);
        publishStatus = "published";
        break;
      }
    }

    res.status(200).json({
      ok: true,
      mode: "live",
      source,
      url,
      steps: STEPS,
      status: publishStatus,
      result: {
        id: upload.publicId,
        caption: caption.caption,
        hashtags: caption.hashtags,
        cloudinaryUrl: upload.reframedUrl,
        containerId,
        mediaId: mediaId || null,
        format: upload.format,
        duration: upload.duration,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
