/**
 * POST /api/publish
 *
 * Creates an Instagram Reels media container and attempts to publish it.
 * If the container is still processing after a few poll cycles the
 * endpoint returns `{ status: "processing", containerId }` so the
 * frontend can continue polling via GET /api/publish-status?id=…
 *
 * Request:  { "videoUrl": "…", "caption": "…" }
 * Response: { "ok": true, "status": "published"|"processing",
 *             "containerId": "…", "mediaId": "…" (if published) }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { parseBody, fail } from "./_lib/types";
import {
  getIgUserId,
  createReelContainer,
  checkContainerStatus,
  publishReel,
} from "./_lib/instagram";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed");
  }

  const body = parseBody(req.body);
  const videoUrl =
    typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const caption =
    typeof body.caption === "string" ? body.caption.trim() : "";

  if (!videoUrl) return fail(res, 400, "A `videoUrl` field is required.");

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return fail(res, 500, "INSTAGRAM_ACCESS_TOKEN is not configured.");
  }

  try {
    // 1. Resolve the IG Business Account.
    const { igUserId } = await getIgUserId(accessToken);

    // 2. Create the Reels container (Instagram starts processing).
    const containerId = await createReelContainer(
      igUserId,
      videoUrl,
      caption,
      accessToken,
    );

    // 3. Poll for up to ~8 s inside this function.
    let statusCode = "IN_PROGRESS";
    for (let i = 0; i < 4; i++) {
      await sleep(2000);
      const check = await checkContainerStatus(containerId, accessToken);
      statusCode = check.statusCode;

      if (statusCode === "ERROR") {
        return fail(
          res,
          500,
          check.errorMessage || "Container processing failed on Instagram.",
        );
      }
      if (statusCode === "FINISHED") break;
    }

    // 4. Publish if ready; otherwise let the frontend poll.
    if (statusCode === "FINISHED") {
      const mediaId = await publishReel(
        igUserId,
        containerId,
        accessToken,
      );
      res.status(200).json({
        ok: true,
        status: "published",
        containerId,
        mediaId,
        igUserId,
      });
    } else {
      res.status(200).json({
        ok: true,
        status: "processing",
        containerId,
        igUserId,
        statusCode,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
