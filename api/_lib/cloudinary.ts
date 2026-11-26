/**
 * Cloudinary — multi-source video ingestion, viral segment clipping, and 9:16 reframing.
 *
 * Supports:
 *  - Twitch.tv Clips (clips.twitch.tv/... & twitch.tv/.../clip/...)
 *  - Twitch.tv VODs (twitch.tv/videos/<id>, including ?t=XhYmZs offsets)
 *    via Twitch GraphQL + usher HLS + fMP4/TS segment ingestion
 *  - YouTube videos & Shorts (via @distube/ytdl-core)
 *  - Direct video URLs (.mp4, .mov, .webm, .m3u8)
 *  - Generic web pages with OpenGraph `og:video` meta tags
 */

import { v2 as cloudinary } from "cloudinary";
import ytdl from "@distube/ytdl-core";

export type SourceUploadResult = {
  publicId: string;
  originalUrl: string;
  analysisUrl: string;
  duration: number;
  bytes: number;
  title?: string;
};

export type AspectMode = "9:16" | "16:9" | "9:16-16:9";
export type CaptionStyle = "viral" | "clean" | "neon" | "cinema";

export type SubtitleCueInput = {
  start: number;
  end: number;
  text: string;
};

export type RenderClipOptions = {
  aspectMode?: AspectMode;
  captionsEnabled?: boolean;
  captionStyle?: CaptionStyle;
  hookTitle?: string;
  subtitles?: SubtitleCueInput[];
};

export type ClippedReelResult = {
  publicId: string;
  clipUrl: string;
  format: string;
  aspectMode: AspectMode;
  captionStyle: CaptionStyle;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  captionsBurned: boolean;
};

const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const MAX_VOD_INGEST_BYTES = 35 * 1024 * 1024; // ~35 MB (~3–5 min at 480p/720p, fast on Vercel)

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

function isTwitchUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "twitch.tv" || host === "clips.twitch.tv" || host === "m.twitch.tv";
  } catch {
    return false;
  }
}

function isDirectVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|mov|webm|mkv|m4v|m3u8)(\?.*)?$/.test(pathname);
  } catch {
    return false;
  }
}

function parseTwitchTimestamp(tParam: string | null): number {
  if (!tParam) return 0;
  const match = tParam.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!match) return 0;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  return h * 3600 + m * 60 + s;
}

const ANALYSIS_TRANSFORMATION = {
  audio_codec: "mp3",
  bit_rate: "64k",
};

function buildAnalysisUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: "video",
    secure: true,
    format: "mp3",
    transformation: [ANALYSIS_TRANSFORMATION],
  });
}

export function buildClipAudioUrl(
  publicId: string,
  startSeconds: number,
  endSeconds: number,
): string {
  const safeStart = Math.max(0, Math.round(startSeconds));
  const safeEnd = Math.max(safeStart + 3, Math.round(endSeconds));
  return cloudinary.url(publicId, {
    resource_type: "video",
    secure: true,
    format: "mp3",
    transformation: [{ start_offset: safeStart, end_offset: safeEnd }],
  });
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  title?: string,
  estimatedDuration?: number,
): Promise<SourceUploadResult> {
  return new Promise<SourceUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "insta-auto/sources",
        format: "mp4",
        eager: [{ format: "mp3", transformation: [ANALYSIS_TRANSFORMATION] }],
        eager_async: true,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            new Error(error?.message || "Cloudinary buffer stream upload failed."),
          );
        }
        resolve({
          publicId: result.public_id,
          originalUrl: result.secure_url,
          analysisUrl: buildAnalysisUrl(result.public_id),
          duration: Math.round(result.duration ?? estimatedDuration ?? 0),
          bytes: result.bytes ?? buffer.byteLength,
          title,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

async function uploadTwitchClip(
  clipSlug: string,
): Promise<SourceUploadResult> {
  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "VideoAccessToken_Clip",
      variables: { slug: clipSlug },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11",
        },
      },
    }),
  });

  const gqlData = (await gqlRes.json()) as {
    data?: {
      clip?: {
        title?: string;
        videoQualities?: { quality: string; sourceURL: string }[];
        playbackAccessToken?: { signature: string; value: string };
      };
    };
    errors?: { message: string }[];
  };

  if (gqlData.errors?.length) {
    throw new Error(`Twitch Clip error: ${gqlData.errors[0].message}`);
  }

  const clip = gqlData.data?.clip;
  const sourceUrl = clip?.videoQualities?.[0]?.sourceURL;
  const token = clip?.playbackAccessToken;

  if (!sourceUrl || !token) {
    throw new Error("Could not resolve Twitch Clip video stream.");
  }

  const signedUrl = `${sourceUrl}?sig=${encodeURIComponent(token.signature)}&token=${encodeURIComponent(token.value)}`;
  const result = await cloudinary.uploader.upload(signedUrl, {
    resource_type: "video",
    folder: "insta-auto/sources",
    eager: [{ format: "mp3", transformation: [ANALYSIS_TRANSFORMATION] }],
    eager_async: true,
  });

  return {
    publicId: result.public_id,
    originalUrl: result.secure_url,
    analysisUrl: buildAnalysisUrl(result.public_id),
    duration: Math.round(result.duration ?? 0),
    bytes: result.bytes ?? 0,
    title: clip?.title,
  };
}

async function uploadTwitchVod(
  vodId: string,
  startOffsetSeconds: number,
): Promise<SourceUploadResult> {
  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query VodToken($vodID: ID!) {
        video(id: $vodID) { id title lengthSeconds }
        videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) {
          value
          signature
        }
      }`,
      variables: { vodID: vodId },
    }),
  });

  const gqlData = (await gqlRes.json()) as {
    data?: {
      video?: { id: string; title?: string; lengthSeconds?: number };
      videoPlaybackAccessToken?: { value: string; signature: string };
    };
    errors?: { message: string }[];
  };

  if (gqlData.errors?.length) {
    throw new Error(`Twitch VOD error: ${gqlData.errors[0].message}`);
  }

  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) {
    throw new Error(
      "Could not resolve Twitch VOD playback token (VOD may be subscriber-only or deleted).",
    );
  }

  const vodTitle = gqlData.data?.video?.title;
  const masterUrl = `https://usher.ttvnw.net/vod/${vodId}.m3u8?allow_source=true&sig=${encodeURIComponent(token.signature)}&token=${encodeURIComponent(token.value)}`;
  const masterRes = await fetch(masterUrl);
  if (!masterRes.ok) {
    throw new Error(`Twitch VOD playlist unavailable (HTTP ${masterRes.status}).`);
  }

  const masterText = await masterRes.text();
  const lines = masterText.split(/\r?\n/);
  const variants: { resolution: string; bandwidth: number; url: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
      const info = lines[i];
      const nextUrl = lines[i + 1]?.trim();
      if (nextUrl && nextUrl.startsWith("http")) {
        const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
        const bwMatch = info.match(/BANDWIDTH=(\d+)/);
        variants.push({
          resolution: resMatch?.[1] || "",
          bandwidth: Number(bwMatch?.[1] || 0),
          url: nextUrl,
        });
      }
    }
  }

  if (variants.length === 0) {
    throw new Error("No playable video streams found in Twitch VOD playlist.");
  }

  // Prefer 480p or 720p so several minutes of VOD ingest cleanly and rapidly.
  const chosen =
    variants.find((v) => v.resolution.includes("852x480")) ??
    variants.find((v) => v.resolution.includes("1280x720")) ??
    variants[Math.min(1, variants.length - 1)];

  const variantRes = await fetch(chosen.url);
  if (!variantRes.ok) {
    throw new Error(`Twitch VOD variant unavailable (HTTP ${variantRes.status}).`);
  }

  const variantText = await variantRes.text();
  const baseUrl = chosen.url.slice(0, chosen.url.lastIndexOf("/") + 1);
  const vLines = variantText.split(/\r?\n/);

  let initUri: string | null = null;
  const segments: { uri: string; duration: number }[] = [];
  let nextDuration = 10;

  for (const rawLine of vLines) {
    const line = rawLine.trim();
    const mapMatch = line.match(/#EXT-X-MAP:URI="([^"]+)"/);
    if (mapMatch) {
      initUri = mapMatch[1];
      continue;
    }
    const extinfMatch = line.match(/^#EXTINF:([\d.]+)/);
    if (extinfMatch) {
      nextDuration = Number(extinfMatch[1]) || 10;
      continue;
    }
    if (line && !line.startsWith("#")) {
      segments.push({ uri: line, duration: nextDuration });
    }
  }

  if (segments.length === 0) {
    throw new Error("Twitch VOD playlist contained zero video segments.");
  }

  // Skip ahead if the user provided ?t=... in the Twitch URL.
  let startIndex = 0;
  if (startOffsetSeconds > 0) {
    let elapsed = 0;
    for (let i = 0; i < segments.length; i++) {
      if (elapsed >= startOffsetSeconds) {
        startIndex = i;
        break;
      }
      elapsed += segments[i].duration;
    }
  }

  const selectedSegments = segments.slice(startIndex);
  const buffers: Buffer[] = [];
  let totalBytes = 0;

  if (initUri) {
    const initUrl = initUri.startsWith("http") ? initUri : baseUrl + initUri;
    const initRes = await fetch(initUrl);
    if (!initRes.ok) {
      throw new Error(`Failed to fetch Twitch VOD init segment (HTTP ${initRes.status}).`);
    }
    const initBuf = Buffer.from(await initRes.arrayBuffer());
    buffers.push(initBuf);
    totalBytes += initBuf.byteLength;
  }

  // Download segments in parallel batches of 6 until we hit MAX_VOD_INGEST_BYTES.
  const BATCH_SIZE = 6;
  let ingestedDuration = 0;
  for (let i = 0; i < selectedSegments.length; i += BATCH_SIZE) {
    const batch = selectedSegments.slice(i, i + BATCH_SIZE);
    const fetched = await Promise.all(
      batch.map(async (seg) => {
        const segUrl = seg.uri.startsWith("http") ? seg.uri : baseUrl + seg.uri;
        const r = await fetch(segUrl);
        if (!r.ok) {
          throw new Error(`Failed to fetch Twitch VOD segment (HTTP ${r.status}).`);
        }
        return {
          buf: Buffer.from(await r.arrayBuffer()),
          duration: seg.duration,
        };
      }),
    );

    for (const item of fetched) {
      buffers.push(item.buf);
      totalBytes += item.buf.byteLength;
      ingestedDuration += item.duration;
      if (totalBytes >= MAX_VOD_INGEST_BYTES) break;
    }
    if (totalBytes >= MAX_VOD_INGEST_BYTES) break;
  }

  const combined = Buffer.concat(buffers);
  return uploadBufferToCloudinary(combined, vodTitle, ingestedDuration);
}

async function uploadTwitchToCloudinary(
  twitchUrl: string,
): Promise<SourceUploadResult> {
  const parsed = new URL(twitchUrl);
  const pathParts = parsed.pathname.split("/").filter(Boolean);

  // 1. Twitch Clip: clips.twitch.tv/<slug> | clips.twitch.tv/embed?clip=<slug> | twitch.tv/<user>/clip/<slug>
  const clipQuery = parsed.searchParams.get("clip");
  const clipIndex = pathParts.indexOf("clip");
  const clipSlug =
    clipQuery ||
    (parsed.hostname === "clips.twitch.tv" && pathParts[0] !== "embed"
      ? pathParts[0]
      : clipIndex !== -1
        ? pathParts[clipIndex + 1]
        : null);

  if (clipSlug) {
    return uploadTwitchClip(clipSlug);
  }

  // 2. Twitch VOD: twitch.tv/videos/<vodId>
  const videosIndex = pathParts.indexOf("videos");
  const vodId = videosIndex !== -1 ? pathParts[videosIndex + 1] : null;

  if (vodId) {
    const offsetSeconds = parseTwitchTimestamp(parsed.searchParams.get("t"));
    return uploadTwitchVod(vodId, offsetSeconds);
  }

  throw new Error(
    "Unsupported Twitch URL. Paste a Twitch Clip (twitch.tv/.../clip/...) or VOD (twitch.tv/videos/...).",
  );
}

async function resolveOgVideo(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function uploadYouTubeToCloudinary(
  youtubeUrl: string,
): Promise<SourceUploadResult> {
  const info = await ytdl.getInfo(youtubeUrl);
  const format =
    ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: "audioandvideo",
    }) ??
    ytdl.chooseFormat(info.formats, {
      filter: (f) => Boolean(f.hasVideo && f.hasAudio),
    });

  if (!format?.url) {
    throw new Error(
      "Could not find a combined video+audio stream for this YouTube URL.",
    );
  }

  return new Promise<SourceUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "insta-auto/sources",
        eager: [{ format: "mp3", transformation: [ANALYSIS_TRANSFORMATION] }],
        eager_async: true,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            new Error(error?.message || "Cloudinary YouTube stream upload failed."),
          );
        }
        resolve({
          publicId: result.public_id,
          originalUrl: result.secure_url,
          analysisUrl: buildAnalysisUrl(result.public_id),
          duration: Math.round(
            result.duration ?? Number(info.videoDetails.lengthSeconds) ?? 0,
          ),
          bytes: result.bytes ?? 0,
          title: info.videoDetails.title,
        });
      },
    );

    const videoStream = ytdl.downloadFromInfo(info, { format });
    videoStream.on("error", (err) => {
      uploadStream.destroy(err);
      reject(new Error(`YouTube download failed: ${err.message}`));
    });
    videoStream.pipe(uploadStream);
  });
}

/**
 * Uploads the source video (Twitch, YouTube, direct MP4, or og:video page)
 * once to Cloudinary and returns its `publicId`, `duration`, and `title`.
 */
export async function uploadSourceVideo(
  videoUrl: string,
): Promise<SourceUploadResult> {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not configured.");
  }

  if (isYouTubeUrl(videoUrl)) {
    return uploadYouTubeToCloudinary(videoUrl);
  }

  if (isTwitchUrl(videoUrl)) {
    return uploadTwitchToCloudinary(videoUrl);
  }

  let targetUrl = videoUrl;
  if (!isDirectVideoUrl(videoUrl)) {
    const ogVideo = await resolveOgVideo(videoUrl);
    if (ogVideo) targetUrl = ogVideo;
  }

  const result = await cloudinary.uploader.upload(targetUrl, {
    resource_type: "video",
    folder: "insta-auto/sources",
    eager: [{ format: "mp3", transformation: [ANALYSIS_TRANSFORMATION] }],
    eager_async: true,
  });

  return {
    publicId: result.public_id,
    originalUrl: result.secure_url,
    analysisUrl: buildAnalysisUrl(result.public_id),
    duration: Math.round(result.duration ?? 0),
    bytes: result.bytes ?? 0,
  };
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function buildSrtContent(subtitles: SubtitleCueInput[]): string {
  return subtitles
    .map((cue, index) => {
      const cleanText = cue.text.replace(/\r?\n/g, " ").trim();
      return `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cleanText}\n`;
    })
    .join("\n");
}

async function uploadSrtToCloudinary(
  srtContent: string,
  slug: string,
): Promise<string> {
  const publicId = `insta-auto/subs/${slug}.srt`;
  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        overwrite: true,
      },
      (err) => (err ? reject(err) : resolve()),
    );
    stream.end(Buffer.from(srtContent, "utf8"));
  });

  // Cloudinary layer syntax replaces `/` with `:` in subtitle overlay IDs.
  return `subtitles:${publicId.replace(/\//g, ":")}`;
}

/**
 * Creates a clipped + formatted MP4 rendition URL for a specific
 * [startSeconds, endSeconds] viral segment and pre-warms it via
 * Cloudinary explicit eager transformation.
 *
 * Supports:
 *  - "9:16":      1080×1920 full vertical crop (captions in lower-third safe zone)
 *  - "16:9":      1920×1080 horizontal widescreen (captions at bottom center)
 *  - "9:16-16:9": 1080×1920 Shorts-style (top hook banner + 16:9 clip + captions directly below)
 */
export async function renderClippedReel(
  publicId: string,
  startSeconds: number,
  endSeconds: number,
  options: AspectMode | RenderClipOptions = "9:16",
): Promise<ClippedReelResult> {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not configured.");
  }

  const opts: RenderClipOptions =
    typeof options === "string" ? { aspectMode: options } : options;
  const aspectMode: AspectMode = opts.aspectMode ?? "9:16";
  const captionStyle: CaptionStyle = opts.captionStyle ?? "viral";
  const safeStart = Math.max(0, Math.round(startSeconds));
  const safeEnd = Math.max(safeStart + 3, Math.round(endSeconds));

  const baseTransform =
    aspectMode === "16:9"
      ? {
          start_offset: safeStart,
          end_offset: safeEnd,
          width: 1920,
          height: 1080,
          crop: "fill",
        }
      : aspectMode === "9:16-16:9"
        ? {
            start_offset: safeStart,
            end_offset: safeEnd,
            width: 1080,
            height: 1920,
            crop: "pad",
            background: "blurred:400:15",
          }
        : {
            start_offset: safeStart,
            end_offset: safeEnd,
            width: 1080,
            height: 1920,
            crop: "fill",
          };

  const pipeline: Record<string, unknown>[] = [baseTransform];
  let captionsBurned = false;

  if (opts.captionsEnabled && Array.isArray(opts.subtitles) && opts.subtitles.length > 0) {
    // 1. Add top viral hook banner in 9:16-16:9 Shorts layout
    if (aspectMode === "9:16-16:9" && opts.hookTitle?.trim()) {
      const cleanHook = opts.hookTitle
        .trim()
        .replace(/[^\p{L}\p{N}\s'?!.-]/gu, "")
        .toUpperCase()
        .slice(0, 48);

      if (cleanHook) {
        const hookBg =
          captionStyle === "clean" || captionStyle === "cinema"
            ? "#111827E6"
            : "#E1306CE6";
        pipeline.push(
          {
            overlay: {
              font_family: "Montserrat",
              font_size: 44,
              font_weight: "bold",
              text_align: "center",
              text: cleanHook,
            },
            color: "#FFFFFF",
            background: hookBg,
            width: 920,
            crop: "fit",
          },
          { flags: "layer_apply", gravity: "north", y: 460 },
        );
      }
    }

    // 2. Upload SRT and burn synced subtitles in the ideal reading position
    const srtContent = buildSrtContent(opts.subtitles);
    const slug = `${Date.now().toString(36)}_${safeStart}_${safeEnd}`;
    const subtitleOverlay = await uploadSrtToCloudinary(srtContent, slug);

    const posY =
      aspectMode === "16:9" ? 70 : aspectMode === "9:16-16:9" ? 470 : 360;

    const styleMap: Record<
      CaptionStyle,
      { color: string; background: string; fontSize: number; fontWeight: string }
    > = {
      viral: {
        color: "#FFE600",
        background: "#000000D9",
        fontSize: aspectMode === "16:9" ? 38 : 42,
        fontWeight: "bold",
      },
      clean: {
        color: "#FFFFFF",
        background: "#000000BF",
        fontSize: aspectMode === "16:9" ? 36 : 40,
        fontWeight: "bold",
      },
      neon: {
        color: "#FFFFFF",
        background: "#E1306CE6",
        fontSize: aspectMode === "16:9" ? 38 : 42,
        fontWeight: "bold",
      },
      cinema: {
        color: "#F8FAFC",
        background: "#00000073",
        fontSize: aspectMode === "16:9" ? 32 : 36,
        fontWeight: "normal",
      },
    };

    const chosenStyle = styleMap[captionStyle];

    pipeline.push(
      {
        overlay: subtitleOverlay,
        color: chosenStyle.color,
        background: chosenStyle.background,
        font_family: "Montserrat",
        font_size: chosenStyle.fontSize,
        font_weight: chosenStyle.fontWeight,
      },
      { flags: "layer_apply", gravity: "south", y: posY },
    );
    captionsBurned = true;
  }

  const formatLabel =
    aspectMode === "16:9"
      ? "1920×1080 (16:9)"
      : aspectMode === "9:16-16:9"
        ? "1080×1920 (16:9 in 9:16)"
        : "1080×1920 (9:16)";

  const explicitResult = await cloudinary.uploader.explicit(publicId, {
    type: "upload",
    resource_type: "video",
    eager: [{ format: "mp4", transformation: pipeline }],
    eager_async: false,
  });

  const eagerUrl = explicitResult.eager?.[0]?.secure_url;
  const fallbackUrl = cloudinary.url(publicId, {
    resource_type: "video",
    secure: true,
    format: "mp4",
    transformation: pipeline,
  });

  return {
    publicId,
    clipUrl: eagerUrl || fallbackUrl,
    format: formatLabel,
    aspectMode,
    captionStyle,
    startSeconds: safeStart,
    endSeconds: safeEnd,
    durationSeconds: safeEnd - safeStart,
    captionsBurned,
  };
}
