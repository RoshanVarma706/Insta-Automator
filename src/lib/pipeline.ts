import { PIPELINE_STEPS, type AspectMode, type CaptionStyle, type Source } from "./mock";

export type IgAccountInfo = {
  igUserId: string;
  username: string;
  pageName: string;
  profilePictureUrl?: string;
};

export type PipelineStatus = {
  configured: boolean;
  igAccount: IgAccountInfo | null;
  error?: string;
};

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type ViralClipInput = {
  url: string;
  source: Source;
  count: number;
  targetDuration: number;
  aspectMode: AspectMode;
  captionsEnabled: boolean;
  captionStyle: CaptionStyle;
  onStep?: (index: number, meta?: { cached?: boolean }) => void;
  isCancelled?: () => boolean;
};

export type GeneratedReel = {
  id: string;
  publicId: string;
  sourceUrl: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  hookReason: string;
  caption: string;
  hashtags: string[];
  subtitles: SubtitleCue[];
  captionsBurned: boolean;
  captionStyle: CaptionStyle;
  videoUrl: string;
  mediaId?: string;
  containerId?: string;
  format: string;
  aspectMode: AspectMode;
  cachedSource?: boolean;
  createdAt: string;
};

export type StoredSource = {
  publicId: string;
  sourceUrl: string;
  originalUrl: string;
  title: string;
  duration: number;
  bytes: number;
  createdAt: string;
};

const LOCAL_CLIPS_KEY = "insta-auto:recent-clips";

function loadLocalClips(): GeneratedReel[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CLIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeneratedReel[]) : [];
  } catch {
    return [];
  }
}

function saveLocalClips(clips: GeneratedReel[]) {
  try {
    window.localStorage.setItem(LOCAL_CLIPS_KEY, JSON.stringify(clips.slice(0, 50)));
  } catch {
    // Ignore storage quota errors
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unexpected response from ${url} (${res.status})`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Request to ${url} failed (${res.status})`,
    );
  }

  return data as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unexpected response from ${url} (${res.status})`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Request to ${url} failed (${res.status})`,
    );
  }

  return data as T;
}

export async function checkPipelineStatus(): Promise<PipelineStatus> {
  try {
    const health = await getJson<{
      ok: boolean;
      configured?: boolean;
      message?: string;
    }>("/api/webhook");

    return {
      configured: Boolean(health.configured),
      igAccount: null,
      error: health.configured ? undefined : health.message,
    };
  } catch (err) {
    return {
      configured: false,
      igAccount: null,
      error: err instanceof Error ? err.message : "API server is unreachable.",
    };
  }
}

async function safeLogJob(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await postJson<{ ok: boolean; id: string }>("/api/jobs", payload);
    return res.id;
  } catch {
    return null;
  }
}

async function safeSaveClip(reel: GeneratedReel): Promise<void> {
  const existing = loadLocalClips().filter((c) => c.id !== reel.id);
  saveLocalClips([reel, ...existing]);

  try {
    await postJson("/api/clips", {
      id: reel.id,
      publicId: reel.publicId,
      sourceUrl: reel.sourceUrl,
      title: reel.title,
      videoUrl: reel.videoUrl,
      startSeconds: reel.startSeconds,
      endSeconds: reel.endSeconds,
      durationSeconds: reel.durationSeconds,
      aspectMode: reel.aspectMode,
      captionStyle: reel.captionStyle,
      caption: reel.caption,
      hashtags: reel.hashtags,
      format: reel.format,
    });
  } catch {
    // Local storage still preserves the clip if Supabase table hasn't been created yet
  }
}

export async function fetchLibraryData(): Promise<{
  clips: GeneratedReel[];
  sources: StoredSource[];
}> {
  const localClips = loadLocalClips();
  try {
    const remote = await getJson<{
      ok: boolean;
      clips: GeneratedReel[];
      sources: StoredSource[];
    }>("/api/clips");

    const map = new Map<string, GeneratedReel>();
    for (const c of remote.clips ?? []) map.set(c.id, c);
    for (const c of localClips) {
      if (!map.has(c.id)) map.set(c.id, c);
    }

    const mergedClips = Array.from(map.values()).sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );

    return {
      clips: mergedClips,
      sources: remote.sources ?? [],
    };
  } catch {
    return { clips: localClips, sources: [] };
  }
}

export async function deleteRecentClip(id: string): Promise<void> {
  const nextLocal = loadLocalClips().filter((c) => c.id !== id);
  saveLocalClips(nextLocal);

  const res = await fetch(`/api/clips?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Failed to delete clip.");
  }
}

export async function deleteDownloadedSource(publicId: string): Promise<void> {
  const nextLocal = loadLocalClips().filter((c) => c.publicId !== publicId);
  saveLocalClips(nextLocal);

  const res = await fetch(
    `/api/clips?type=source&publicId=${encodeURIComponent(publicId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Failed to delete source.");
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Runs the 4-step viral clipping pipeline:
 *  1. Match existing downloaded video by URL or upload source to Cloudinary
 *  2. Gemini analyzes audio/video & picks non-overlapping viral clips
 *  3. Transcribe exact verbatim speech cues from MP3 audio
 *  4. Clip, format & burn clean captions in Cloudinary
 */
export async function runRealPipeline({
  url,
  source,
  count,
  targetDuration,
  aspectMode,
  captionsEnabled,
  captionStyle,
  onStep,
  isCancelled,
}: ViralClipInput): Promise<GeneratedReel[]> {
  if (isCancelled?.()) throw new Error("cancelled");
  onStep?.(0);
  const jobId = await safeLogJob({ action: "create", url, source });

  try {
    // Step 0: Match cached source or download & upload source video
    if (jobId) await safeLogJob({ action: "update", id: jobId, status: "uploading" });
    const uploaded = await postJson<{
      publicId: string;
      originalUrl: string;
      analysisUrl?: string;
      duration: number;
      title?: string;
      cached?: boolean;
    }>("/api/upload", { url });

    // Step 1: Gemini viral clip identification
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(1, { cached: uploaded.cached });
    if (jobId) await safeLogJob({ action: "update", id: jobId, status: "captioning" });

    const analysis = await postJson<{
      clips: {
        title: string;
        startSeconds: number;
        endSeconds: number;
        hookReason: string;
        caption: string;
        hashtags: string[];
      }[];
    }>("/api/caption", {
      url,
      source,
      count,
      targetDuration,
      totalDuration: uploaded.duration,
      videoTitle: uploaded.title,
      analysisUrl: uploaded.analysisUrl,
    });

    // Step 2: Verbatim MP3 speech transcription for each viral clip
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(2, { cached: uploaded.cached });

    const clipTranscriptions: {
      subtitles: SubtitleCue[];
      title?: string;
      caption?: string;
      hashtags?: string[];
      trimStartOffset?: number;
    }[] = [];
    for (const clip of analysis.clips) {
      if (isCancelled?.()) throw new Error("cancelled");
      if (!captionsEnabled) {
        clipTranscriptions.push({ subtitles: [] });
        continue;
      }

      const transcribed = await postJson<{
        subtitles: SubtitleCue[];
        title?: string;
        caption?: string;
        hashtags?: string[];
        trimStartOffset?: number;
      }>("/api/transcribe", {
        publicId: uploaded.publicId,
        startSeconds: clip.startSeconds,
        endSeconds: clip.endSeconds,
        captionStyle,
      });
      clipTranscriptions.push({
        subtitles: transcribed.subtitles ?? [],
        title: transcribed.title,
        caption: transcribed.caption,
        hashtags: transcribed.hashtags,
        trimStartOffset: transcribed.trimStartOffset,
      });
    }

    // Step 3: Clip, format & burn captions in Cloudinary
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(3, { cached: uploaded.cached });

    const renderedReels: GeneratedReel[] = [];
    const batchTs = Date.now().toString(36);

    for (let i = 0; i < analysis.clips.length; i++) {
      if (isCancelled?.()) throw new Error("cancelled");
      const clip = analysis.clips[i];
      const tr = clipTranscriptions[i] ?? { subtitles: [] };
      const finalTitle = tr.title || clip.title;
      const finalCaption = tr.caption || clip.caption;
      const finalHashtags = tr.hashtags?.length ? tr.hashtags : clip.hashtags;
      const finalStart = clip.startSeconds + (tr.trimStartOffset || 0);

      const rendered = await postJson<{
        publicId: string;
        clipUrl: string;
        format: string;
        aspectMode: AspectMode;
        captionStyle: CaptionStyle;
        startSeconds: number;
        endSeconds: number;
        durationSeconds: number;
        captionsBurned?: boolean;
      }>("/api/upload", {
        publicId: uploaded.publicId,
        startSeconds: finalStart,
        endSeconds: clip.endSeconds,
        aspectMode,
        captionsEnabled,
        captionStyle,
        hookTitle: finalTitle,
        subtitles: tr.subtitles,
        clipIndex: i,
      });

      const reel: GeneratedReel = {
        id: `clip_${batchTs}_${i + 1}`,
        publicId: uploaded.publicId,
        sourceUrl: url,
        title: finalTitle,
        startSeconds: rendered.startSeconds,
        endSeconds: rendered.endSeconds,
        durationSeconds: rendered.durationSeconds,
        hookReason: clip.hookReason,
        caption: finalCaption,
        hashtags: finalHashtags,
        subtitles: tr.subtitles,
        captionsBurned: Boolean(rendered.captionsBurned),
        captionStyle: rendered.captionStyle || captionStyle,
        videoUrl: rendered.clipUrl,
        format: rendered.format || "1080×1920",
        aspectMode: rendered.aspectMode || aspectMode,
        cachedSource: Boolean(uploaded.cached),
        createdAt: new Date().toISOString(),
      };

      renderedReels.push(reel);
      await safeSaveClip(reel);
    }

    if (jobId) {
      await safeLogJob({
        action: "update",
        id: jobId,
        status: "published",
        caption: renderedReels[0]?.caption,
        hashtags: renderedReels[0]?.hashtags,
        cloudinary_public_id: uploaded.publicId,
        cloudinary_url: renderedReels[0]?.videoUrl,
      });
    }

    return renderedReels;
  } catch (err) {
    if (jobId && !(err instanceof Error && err.message === "cancelled")) {
      await safeLogJob({
        action: "update",
        id: jobId,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

/**
 * Optional: publish an already-clipped 9:16 Reel to Instagram via Meta Graph API.
 */
export async function publishClipToInstagram(
  reel: GeneratedReel,
): Promise<{ mediaId: string; containerId: string }> {
  const fullCaption = `${reel.caption}\n\n${reel.hashtags.join(" ")}`;
  const publishRes = await postJson<{
    status: "published" | "processing";
    containerId: string;
    mediaId?: string;
  }>("/api/publish", {
    videoUrl: reel.videoUrl,
    caption: fullCaption,
  });

  if (publishRes.status === "published" && publishRes.mediaId) {
    return {
      mediaId: publishRes.mediaId,
      containerId: publishRes.containerId,
    };
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    await sleep(3000);
    const poll = await getJson<{
      status: "processing" | "published" | "error";
      mediaId?: string;
      error?: string;
    }>(`/api/publish-status?id=${encodeURIComponent(publishRes.containerId)}`);

    if (poll.status === "error") {
      throw new Error(poll.error || "Instagram container processing failed.");
    }
    if (poll.status === "published" && poll.mediaId) {
      return {
        mediaId: poll.mediaId,
        containerId: publishRes.containerId,
      };
    }
  }

  throw new Error("Timed out waiting for Instagram to finish processing the Reel.");
}

export { PIPELINE_STEPS };
