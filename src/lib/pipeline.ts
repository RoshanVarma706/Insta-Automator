import {
  PIPELINE_STEPS,
  makeTitle,
  runMockPipeline,
  type MockResult,
  type PipelineInput,
} from "./mock";

export type PipelineMode = "live" | "mock";

export type IgAccountInfo = {
  igUserId: string;
  username: string;
  pageName: string;
  profilePictureUrl?: string;
};

export type PipelineStatus = {
  mode: PipelineMode;
  igAccount: IgAccountInfo | null;
  error?: string;
};

export type PipelineResult = MockResult & {
  mode: PipelineMode;
  containerId?: string;
};

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

/**
 * Checks whether the serverless /api endpoints are live and resolves the
 * connected Instagram Business account via /api/ig-user.
 */
export async function checkPipelineStatus(): Promise<PipelineStatus> {
  try {
    const health = await getJson<{ ok: boolean; mode?: PipelineMode }>("/api/webhook");
    if (health.mode !== "live") {
      return { mode: "mock", igAccount: null };
    }

    try {
      const ig = await getJson<IgAccountInfo & { ok: boolean }>("/api/ig-user");
      return {
        mode: "live",
        igAccount: {
          igUserId: ig.igUserId,
          username: ig.username,
          pageName: ig.pageName,
          profilePictureUrl: ig.profilePictureUrl,
        },
      };
    } catch (err) {
      return {
        mode: "live",
        igAccount: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } catch {
    // When running `vite` locally without Vercel functions, fall back to mock mode.
    return { mode: "mock", igAccount: null };
  }
}

async function safeLogJob(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await postJson<{ ok: boolean; id: string }>("/api/jobs", payload);
    return res.id;
  } catch {
    // Job logging is best-effort so missing Supabase tables won't block publishing.
    return null;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:30";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the 5-step pipeline step-by-step against the real /api endpoints,
 * updating the UI at each stage. Falls back to `runMockPipeline` if the
 * backend is in mock mode.
 */
export async function runRealPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { url, source, onStep, isCancelled } = input;

  const status = await checkPipelineStatus();
  if (status.mode === "mock") {
    const mock = await runMockPipeline(input);
    return { ...mock, mode: "mock" };
  }

  // Step 0: Detect source & create job record
  if (isCancelled?.()) throw new Error("cancelled");
  onStep?.(0);
  const jobId = await safeLogJob({ action: "create", url, source });

  try {
    // Step 1: Write caption & hashtags (Gemini)
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(1);
    if (jobId) await safeLogJob({ action: "update", id: jobId, status: "captioning" });

    const captionRes = await postJson<{
      caption: string;
      hashtags: string[];
    }>("/api/caption", { url, source });

    // Step 2: Reframe to 9:16 (Cloudinary)
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(2);
    if (jobId) {
      await safeLogJob({
        action: "update",
        id: jobId,
        status: "uploading",
        caption: captionRes.caption,
        hashtags: captionRes.hashtags,
      });
    }

    const uploadRes = await postJson<{
      publicId: string;
      reframedUrl: string;
      format: string;
      duration: number;
    }>("/api/upload", { url });

    // Step 3: Create Instagram media container
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(3);
    if (jobId) {
      await safeLogJob({
        action: "update",
        id: jobId,
        status: "publishing",
        cloudinary_public_id: uploadRes.publicId,
        cloudinary_url: uploadRes.reframedUrl,
      });
    }

    const fullCaption = `${captionRes.caption}\n\n${captionRes.hashtags.join(" ")}`;
    const publishRes = await postJson<{
      status: "published" | "processing";
      containerId: string;
      mediaId?: string;
    }>("/api/publish", {
      videoUrl: uploadRes.reframedUrl,
      caption: fullCaption,
    });

    // Step 4: Poll (if still processing) & Publish to Reels
    if (isCancelled?.()) throw new Error("cancelled");
    onStep?.(4);

    let mediaId = publishRes.mediaId ?? "";

    if (publishRes.status === "processing") {
      if (jobId) {
        await safeLogJob({
          action: "update",
          id: jobId,
          status: "polling",
          ig_container_id: publishRes.containerId,
        });
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (isCancelled?.()) throw new Error("cancelled");
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
          mediaId = poll.mediaId;
          break;
        }
      }
    }

    if (!mediaId) {
      throw new Error("Timed out waiting for Instagram to finish processing the Reel.");
    }

    if (jobId) {
      await safeLogJob({
        action: "update",
        id: jobId,
        status: "published",
        ig_container_id: publishRes.containerId,
        ig_media_id: mediaId,
      });
    }

    return {
      id: uploadRes.publicId,
      source,
      title: makeTitle(source, url),
      caption: captionRes.caption,
      hashtags: captionRes.hashtags,
      videoUrl: uploadRes.reframedUrl,
      mediaId,
      duration: formatDuration(uploadRes.duration),
      size: uploadRes.format || "1080 × 1920",
      createdAt: new Date().toISOString(),
      mode: "live",
      containerId: publishRes.containerId,
    };
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

export { PIPELINE_STEPS };
