/**
 * GET  /api/jobs       -> list recent jobs from Supabase
 * POST /api/jobs       -> create or update a job record in Supabase
 */

import type { ApiRequest, ApiResponse } from "./_lib/types";
import { parseBody, fail } from "./_lib/types";
import { createJob, listJobs, updateJob, type JobStatus } from "./_lib/supabase";

const VALID_STATUSES: JobStatus[] = [
  "pending",
  "captioning",
  "uploading",
  "publishing",
  "polling",
  "published",
  "failed",
];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 503, "Supabase is not configured.");
  }

  if (req.method === "GET") {
    try {
      const jobs = await listJobs(50);
      return res.status(200).json({ ok: true, jobs });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(res, 500, message);
    }
  }

  if (req.method === "POST") {
    const body = parseBody(req.body);
    const action = body.action === "update" ? "update" : "create";

    try {
      if (action === "create") {
        const url = typeof body.url === "string" ? body.url.trim() : "";
        const source = typeof body.source === "string" ? body.source : "generic";
        if (!url) return fail(res, 400, "A `url` field is required.");

        const id = await createJob(url, source);
        return res.status(200).json({ ok: true, id });
      }

      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) return fail(res, 400, "A `id` field is required for updates.");

      const updates: Record<string, unknown> = {};
      if (typeof body.status === "string" && VALID_STATUSES.includes(body.status as JobStatus)) {
        updates.status = body.status;
      }
      if (typeof body.caption === "string") updates.caption = body.caption;
      if (Array.isArray(body.hashtags)) updates.hashtags = body.hashtags;
      if (typeof body.cloudinary_public_id === "string") {
        updates.cloudinary_public_id = body.cloudinary_public_id;
      }
      if (typeof body.cloudinary_url === "string") {
        updates.cloudinary_url = body.cloudinary_url;
      }
      if (typeof body.ig_container_id === "string") {
        updates.ig_container_id = body.ig_container_id;
      }
      if (typeof body.ig_media_id === "string") {
        updates.ig_media_id = body.ig_media_id;
      }
      if (typeof body.error === "string") updates.error = body.error;

      await updateJob(id, updates);
      return res.status(200).json({ ok: true, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(res, 500, message);
    }
  }

  res.setHeader("Allow", "GET, POST");
  return fail(res, 405, "Method not allowed");
}
