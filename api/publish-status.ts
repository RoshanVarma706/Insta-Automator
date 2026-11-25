/**
 * GET /api/publish-status?id=<containerId>
 *
 * Checks the processing status of an Instagram Reels container.
 * When the container reaches FINISHED, automatically publishes it
 * and returns the media ID.
 *
 * Response: { "ok": true, "status": "processing"|"published"|"error", … }
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { fail } from "./_lib/types";
import {
  getIgUserId,
  checkContainerStatus,
  publishReel,
} from "./_lib/instagram";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return fail(res, 405, "Method not allowed");
  }

  const rawId = req.query?.id;
  const containerId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!containerId) {
    return fail(res, 400, "Query parameter `id` (container ID) is required.");
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return fail(res, 500, "INSTAGRAM_ACCESS_TOKEN is not configured.");
  }

  try {
    const check = await checkContainerStatus(containerId, accessToken);

    if (check.statusCode === "FINISHED") {
      const { igUserId } = await getIgUserId(accessToken);
      const mediaId = await publishReel(
        igUserId,
        containerId,
        accessToken,
      );
      return res.status(200).json({
        ok: true,
        status: "published",
        mediaId,
      });
    }

    if (check.statusCode === "ERROR" || check.statusCode === "EXPIRED") {
      return res.status(200).json({
        ok: true,
        status: "error",
        error:
          check.errorMessage || "Container processing failed or expired.",
      });
    }

    // Still processing.
    res.status(200).json({
      ok: true,
      status: "processing",
      statusCode: check.statusCode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(res, 500, message);
  }
}
