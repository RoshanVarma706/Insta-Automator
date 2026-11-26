/**
 * GET    /api/clips         -> list recent clips + downloaded sources
 * POST   /api/clips         -> save a generated clip record
 * DELETE /api/clips         -> delete a clip record or a downloaded source (+ Cloudinary asset)
 */

import type { ApiRequest, ApiResponse } from "./_lib/types.js";
import { parseBody, fail, errorMessage } from "./_lib/types.js";
import {
  destroyCloudinaryVideo,
  listCloudinarySources,
} from "./_lib/cloudinary.js";
import {
  deleteSupabaseClip,
  deleteSupabaseSource,
  listSupabaseClips,
  listSupabaseSources,
  saveClipRecord,
  type ClipRecord,
} from "./_lib/supabase.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const [sbClips, sbSources, cldSources] = await Promise.all([
        listSupabaseClips(50),
        listSupabaseSources(50),
        listCloudinarySources(),
      ]);

      // Merge Supabase sources and Cloudinary sources deduplicated by publicId
      const sourceMap = new Map<
        string,
        {
          publicId: string;
          sourceUrl: string;
          originalUrl: string;
          title: string;
          duration: number;
          bytes: number;
          createdAt: string;
        }
      >();

      for (const s of sbSources) {
        sourceMap.set(s.public_id, {
          publicId: s.public_id,
          sourceUrl: s.source_url,
          originalUrl: s.original_url,
          title: s.title || s.source_url,
          duration: s.duration || 0,
          bytes: s.bytes || 0,
          createdAt: s.created_at || new Date().toISOString(),
        });
      }
      for (const s of cldSources) {
        if (!sourceMap.has(s.publicId)) {
          sourceMap.set(s.publicId, {
            publicId: s.publicId,
            sourceUrl: s.sourceUrl,
            originalUrl: s.originalUrl,
            title: s.title,
            duration: s.duration,
            bytes: s.bytes,
            createdAt: s.createdAt,
          });
        }
      }

      const clips = sbClips.map((c) => ({
        id: c.id,
        sourceUrl: c.source_url,
        publicId: c.public_id,
        title: c.title,
        videoUrl: c.clip_url,
        startSeconds: c.start_seconds,
        endSeconds: c.end_seconds,
        durationSeconds: c.duration_seconds,
        aspectMode: c.aspect_mode,
        captionStyle: c.caption_style,
        caption: c.caption || "",
        hashtags: c.hashtags || [],
        format: c.format || "1080×1920",
        createdAt: c.created_at || new Date().toISOString(),
      }));

      return res.status(200).json({
        ok: true,
        clips,
        sources: Array.from(sourceMap.values()),
      });
    } catch (err: unknown) {
      return fail(res, 500, errorMessage(err));
    }
  }

  if (req.method === "POST") {
    const body = parseBody(req.body);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";

    if (!id || !videoUrl || !publicId) {
      return fail(res, 400, "`id`, `publicId`, and `videoUrl` are required.");
    }

    const record: ClipRecord = {
      id,
      source_url: typeof body.sourceUrl === "string" ? body.sourceUrl : "",
      public_id: publicId,
      title: typeof body.title === "string" ? body.title : "Generated Clip",
      clip_url: videoUrl,
      start_seconds: Math.round(Number(body.startSeconds) || 0),
      end_seconds: Math.round(Number(body.endSeconds) || 30),
      duration_seconds: Math.round(Number(body.durationSeconds) || 30),
      aspect_mode: typeof body.aspectMode === "string" ? body.aspectMode : "9:16-16:9",
      caption_style: typeof body.captionStyle === "string" ? body.captionStyle : "viral",
      caption: typeof body.caption === "string" ? body.caption : "",
      hashtags: Array.isArray(body.hashtags) ? (body.hashtags as string[]) : [],
      format: typeof body.format === "string" ? body.format : "1080×1920",
    };

    try {
      await saveClipRecord(record);
      return res.status(200).json({ ok: true, id });
    } catch (err: unknown) {
      return fail(res, 500, errorMessage(err));
    }
  }

  if (req.method === "DELETE") {
    const type = Array.isArray(req.query?.type) ? req.query?.type[0] : req.query?.type;
    const id = Array.isArray(req.query?.id) ? req.query?.id[0] : req.query?.id;
    const publicId = Array.isArray(req.query?.publicId)
      ? req.query?.publicId[0]
      : req.query?.publicId;

    try {
      if (type === "source" && publicId) {
        await Promise.all([
          deleteSupabaseSource(publicId),
          destroyCloudinaryVideo(publicId),
        ]);
        return res.status(200).json({ ok: true, deleted: publicId, type: "source" });
      }

      if (id) {
        await deleteSupabaseClip(id);
        return res.status(200).json({ ok: true, deleted: id, type: "clip" });
      }

      return fail(res, 400, "Provide `id` (clip) or `type=source&publicId=...`.");
    } catch (err: unknown) {
      return fail(res, 500, errorMessage(err));
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return fail(res, 405, "Method not allowed");
}
