/**
 * Gemini API — viral clip identification + verbatim MP3 speech transcription.
 *
 * Pass 1 (`analyzeViralClips`): uses MEDIUM thinking on the audio track to
 *   pick distinct, non-overlapping viral clips with strong opening hooks and
 *   complete endings.
 * Pass 2 (`transcribeClipAudio`): uses temperature 0.0 on the exact clipped
 *   MP3 snippet for 1–3 word verbatim cues, refines clip title/caption, and
 *   computes `trimStartOffset` to strip dead intro silence.
 */

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
] as const;

const TOTAL_BUDGET_MS = 54_000;

export type CaptionStyle = "viral" | "clean" | "neon" | "cinema";

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type ViralClip = {
  title: string;
  startSeconds: number;
  endSeconds: number;
  hookReason: string;
  caption: string;
  hashtags: string[];
  subtitles: SubtitleCue[];
};

export type AnalyzeClipsInput = {
  videoUrl: string;
  source: string;
  count: number;
  targetDuration: number; // e.g. 30, 45, 60
  totalDuration?: number;
  videoTitle?: string;
  analysisUrl?: string;
};

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

function getDurationBounds(targetDuration: number): {
  minDuration: number;
  maxDuration: number;
} {
  if (targetDuration >= 60) {
    return { minDuration: 45, maxDuration: 60 };
  }
  return {
    minDuration: Math.max(15, Math.round(targetDuration * 0.8)),
    maxDuration: Math.min(60, targetDuration + 12),
  };
}

function extractFirstJson(raw: string, openChar: "{" | "[", closeChar: "}" | "]"): string | null {
  const start = raw.indexOf(openChar);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseJsonSafe<T>(raw: string): T | null {
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Fall through to balanced extractor
  }

  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const tryOrder: [("{" | "["), ("}" | "]")][] =
    firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)
      ? [["[", "]"], ["{", "}"]]
      : [["{", "}"], ["[", "]"]];

  for (const [open, close] of tryOrder) {
    const extracted = extractFirstJson(trimmed, open, close);
    if (!extracted) continue;
    try {
      return JSON.parse(extracted) as T;
    } catch {
      continue;
    }
  }

  return null;
}

function buildClipPrompt(input: AnalyzeClipsInput): string {
  const { videoUrl, source, count, targetDuration, totalDuration, videoTitle } = input;
  const { minDuration, maxDuration } = getDurationBounds(targetDuration);
  const durationHint =
    totalDuration && totalDuration > 0
      ? `Total video duration: ${Math.round(totalDuration)} seconds. Every timestamp MUST be between 0 and ${Math.round(totalDuration)}.`
      : "Ensure all timestamps fit within the actual video length.";
  const titleHint = videoTitle ? `Video title: ${videoTitle}\n` : "";

  const endingRule =
    targetDuration >= 60
      ? `4. DURATION HARD CAP (60s MAX): \`endSeconds - startSeconds\` MUST be between ${minDuration} and 60 seconds — NEVER exceed 60 seconds. End cleanly on a natural pause or completed sentence at or just before 60s.`
      : `4. SMART FLEXIBLE ENDING DURATION: Target ~${targetDuration} seconds, and EXTEND the ending up to ${maxDuration} seconds (acceptable range: ${minDuration}–${maxDuration} seconds) whenever extra seconds are needed to finish the speaker's sentence or punchline cleanly (e.g., if 30s is selected and the punchline finishes at 36s, end at 36s!). Never cut mid-sentence just to hit ${targetDuration}s.`;

  const multiClipRule =
    count > 1
      ? `5. STRICTLY DISTINCT & NON-OVERLAPPING: You MUST select ${count} DIFFERENT moments from SEPARATE parts of the timeline. NEVER return duplicate or overlapping timestamps!`
      : `5. Pick the single strongest viral moment in the entire track.`;

  return `You are a viral short-form video editor (TikTok, Instagram Reels, YouTube Shorts).
Listen carefully to the entire audio/video and pick the ${count} MOST VIRAL, self-contained clip(s).

Video URL: ${videoUrl}
Source: ${source}
${titleHint}Requested clip count: ${count}
Preferred duration: ${targetDuration} seconds (allowed range: ${minDuration}–${maxDuration} seconds)
${durationHint}

HOW TO PICK VIRAL CLIPS WITH STRONG START & END POINTS:
1. Scan the entire timeline from 0 to end. Look for funny stories, bold opinions, viewer Q&A hooks, emotional reactions, surprises, or heated/entertaining moments.
2. STRONG OPENING HOOK (\`startSeconds\`): Must start AT THE EXACT BEGINNING of a compelling question, bold statement, reaction, or story opener — NEVER mid-sentence and NEVER during 2+ seconds of dead silence.
3. STRONG ENDING PAYOFF (\`endSeconds\`): Must end RIGHT AFTER the punchline, final answer, laugh, or complete thought — NEVER mid-sentence or right before the payoff.
${endingRule}
${multiClipRule}
6. Rank from most viral to least viral.

Return ONLY valid JSON:
{
  "clips": [
    {
      "title": "Catchy 4-7 word hook title",
      "startSeconds": 12,
      "endSeconds": ${12 + targetDuration},
      "hookReason": "Quote the exact opening hook and closing payoff explaining why this clip works",
      "caption": "Scroll-stopping Instagram caption (1-2 sentences + 1-2 emojis)",
      "hashtags": ["#reels", "#viral", "#fyp", "#trending", "#instagood"]
    }
  ]
}`;
}

async function callSingleGemini<T>(
  model: string,
  apiKey: string,
  parts: unknown[],
  timeoutMs: number,
  options: {
    temperature: number;
    thinkingLevel: "MINIMAL" | "LOW" | "MEDIUM";
    maxOutputTokens: number;
  },
  validator: (parsed: T) => boolean,
): Promise<{ data: T } | { error: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    responseMimeType: "application/json",
  };

  if (model.startsWith("gemini-3")) {
    generationConfig.thinkingConfig = { thinkingLevel: options.thinkingLevel };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `${model} (${response.status}): ${errText.slice(0, 180)}` };
    }

    const data = await response.json();
    const candidateParts = (data.candidates?.[0]?.content?.parts ?? []) as {
      text?: string;
      thought?: boolean;
    }[];

    const textParts = candidateParts
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text!.trim())
      .filter(Boolean);

    for (const chunk of [...textParts, textParts.join("\n")]) {
      const parsed = parseJsonSafe<T>(chunk);
      if (parsed && validator(parsed)) {
        return { data: parsed };
      }
    }

    return { error: `${model} returned unparseable or empty JSON.` };
  } catch (err) {
    return {
      error: `${model}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function callGeminiWithBudget<T>(
  apiKey: string,
  parts: unknown[],
  deadlineMs: number,
  options: {
    temperature: number;
    thinkingLevel: "MINIMAL" | "LOW" | "MEDIUM";
    maxOutputTokens: number;
  },
  validator: (parsed: T) => boolean,
): Promise<T> {
  let lastError = "Gemini timed out.";

  for (const model of GEMINI_MODELS) {
    const remaining = deadlineMs - Date.now();
    if (remaining < 4000) break;

    const timeoutMs = Math.min(35_000, remaining - 800);
    const result = await callSingleGemini<T>(
      model,
      apiKey,
      parts,
      timeoutMs,
      options,
      validator,
    );

    if ("data" in result) return result.data;
    lastError = result.error;
  }

  throw new Error(`Gemini API failed: ${lastError}`);
}

function normalizeSubtitles(
  rawSubs: Partial<SubtitleCue>[],
  clipDuration: number,
  captionStyle: CaptionStyle,
): SubtitleCue[] {
  const cleaned: SubtitleCue[] = [];
  let cursor = 0;

  for (const raw of rawSubs) {
    let text = typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim() : "";
    if (!text) continue;

    if (captionStyle === "viral" || captionStyle === "neon") {
      text = text.toUpperCase();
    }

    let start = Number(raw.start);
    let end = Number(raw.end);
    if (!Number.isFinite(start)) start = cursor;
    if (!Number.isFinite(end)) end = start + 1.8;

    start = Math.max(cursor, Math.min(clipDuration - 0.3, start));
    end = Math.max(start + 0.35, Math.min(clipDuration, end));

    if (start >= clipDuration - 0.2) break;

    cleaned.push({
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text,
    });
    cursor = end;
  }

  return cleaned;
}

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function findNonOverlappingSlot(
  used: { start: number; end: number }[],
  desiredLen: number,
  maxVideoEnd: number,
): { start: number; end: number } | null {
  const sorted = [...used].sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let prev = 0;

  for (const seg of sorted) {
    if (seg.start - prev >= 10) {
      gaps.push({ start: prev, end: seg.start });
    }
    prev = Math.max(prev, seg.end);
  }
  if (maxVideoEnd - prev >= 10) {
    gaps.push({ start: prev, end: maxVideoEnd });
  }

  if (gaps.length === 0) return null;
  gaps.sort((a, b) => b.end - b.start - (a.end - a.start));
  const best = gaps[0];
  const len = Math.min(desiredLen, best.end - best.start);
  return { start: best.start, end: best.start + len };
}

function normalizeClips(
  rawClips: Partial<ViralClip>[],
  count: number,
  targetDuration: number,
  totalDuration?: number,
): ViralClip[] {
  const { maxDuration } = getDurationBounds(targetDuration);
  const maxVideoEnd =
    totalDuration && totalDuration > 0 ? Math.floor(totalDuration) : Number.MAX_SAFE_INTEGER;

  const used: { start: number; end: number }[] = [];
  const normalized: ViralClip[] = [];

  for (let index = 0; index < Math.min(count, rawClips.length); index++) {
    const clip = rawClips[index];
    let start = Math.max(0, Math.round(Number(clip.startSeconds) || index * targetDuration));
    let end = Math.round(Number(clip.endSeconds) || start + targetDuration);

    if (end <= start) {
      end = start + targetDuration;
    }
    if (end - start > maxDuration) {
      end = start + maxDuration;
    }

    if (maxVideoEnd < Number.MAX_SAFE_INTEGER) {
      if (start >= maxVideoEnd - 5) {
        start = Math.max(0, maxVideoEnd - targetDuration);
      }
      end = Math.min(maxVideoEnd, end);
      if (end - start < 5) {
        start = Math.max(0, maxVideoEnd - targetDuration);
        end = Math.min(maxVideoEnd, start + maxDuration);
      }
    }

    // Prevent duplicate / heavily overlapping clips
    const overlapsExisting = used.some(
      (u) =>
        (u.start === start && u.end === end) ||
        overlapSeconds(u.start, u.end, start, end) > 5,
    );

    if (overlapsExisting && maxVideoEnd < Number.MAX_SAFE_INTEGER) {
      const slot = findNonOverlappingSlot(used, Math.min(targetDuration, maxDuration), maxVideoEnd);
      if (!slot) {
        // Avoid emitting an identical duplicate clip if no distinct segment remains
        continue;
      }
      start = slot.start;
      end = slot.end;
    }

    used.push({ start, end });

    normalized.push({
      title: clip.title?.trim() || `Viral Clip #${normalized.length + 1}`,
      startSeconds: start,
      endSeconds: end,
      hookReason:
        clip.hookReason?.trim() ||
        "High-energy segment with a clean opening hook and strong closing beat.",
      caption: clip.caption?.trim() || "Watch until the end! 🔥",
      hashtags:
        Array.isArray(clip.hashtags) && clip.hashtags.length > 0
          ? clip.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`))
          : ["#reels", "#viral", "#fyp", "#trending", "#instagood"],
      subtitles: [],
    });
  }

  return normalized;
}

async function fetchInlineMediaPart(
  analysisUrl: string,
  timeoutMs: number,
): Promise<unknown | null> {
  try {
    const res = await fetch(analysisUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 12 * 1024 * 1024) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 12 * 1024 * 1024) return null;
    const mimeType = analysisUrl.toLowerCase().includes(".mp3")
      ? "audio/mp3"
      : "video/mp4";
    return {
      inlineData: {
        mimeType,
        data: buf.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Pass 1: Identifies distinct, non-overlapping viral clips with strong opening
 * hooks and clean endings.
 */
export async function analyzeViralClips(
  input: AnalyzeClipsInput,
): Promise<ViralClip[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const startedAt = Date.now();
  const hardDeadline = startedAt + TOTAL_BUDGET_MS;

  const prompt = buildClipPrompt(input);
  const parts: unknown[] = [];

  if (isYouTubeUrl(input.videoUrl)) {
    parts.push({
      fileData: {
        fileUri: input.videoUrl,
      },
    });
  } else if (input.analysisUrl) {
    const inlinePart = await fetchInlineMediaPart(input.analysisUrl, 25_000);
    if (inlinePart) parts.push(inlinePart);
  }

  parts.push({ text: prompt });

  const validator = (p: { clips?: Partial<ViralClip>[] }) =>
    Boolean(p && Array.isArray(p.clips) && p.clips.length > 0);

  let parsed: { clips?: Partial<ViralClip>[] };
  try {
    const mediaDeadline = parts.length > 1 ? hardDeadline - 4_000 : hardDeadline;
    parsed = await callGeminiWithBudget(
      apiKey,
      parts,
      mediaDeadline,
      { temperature: 0.4, thinkingLevel: "MEDIUM", maxOutputTokens: 2048 },
      validator,
    );
  } catch (err) {
    if (parts.length > 1 && hardDeadline - Date.now() >= 4_000) {
      parsed = await callGeminiWithBudget(
        apiKey,
        [{ text: prompt }],
        hardDeadline,
        { temperature: 0.5, thinkingLevel: "MINIMAL", maxOutputTokens: 2048 },
        validator,
      );
    } else {
      throw err;
    }
  }

  return normalizeClips(
    parsed.clips ?? [],
    input.count,
    input.targetDuration,
    input.totalDuration,
  );
}

export type TranscribeResult = {
  subtitles: SubtitleCue[];
  title?: string;
  caption?: string;
  hashtags?: string[];
  trimStartOffset?: number;
};

/**
 * Pass 2: Downloads the exact MP3 audio snippet of the clipped segment,
 * transcribes ONLY the verbatim spoken words in crisp 1–3 word lines,
 * refines title/caption/hashtags, and returns `trimStartOffset` if the
 * clip opens with dead silence (> 1.5s) so the clip starts right on the hook.
 */
export async function transcribeClipAudio(
  audioUrl: string,
  clipDuration: number,
  captionStyle: CaptionStyle = "viral",
): Promise<TranscribeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const audioRes = await fetch(audioUrl, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!audioRes.ok) {
    throw new Error(`Could not fetch clip audio for transcription (${audioRes.status}).`);
  }

  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  if (audioBuf.byteLength === 0) {
    return { subtitles: [] };
  }

  const wordsPerCue =
    captionStyle === "clean" || captionStyle === "cinema"
      ? "2 to 4 words (fits on 1 short line)"
      : "1 to 3 punchy words (fits on 1 short line)";

  const prompt = `Listen carefully to this ${clipDuration}-second audio clip and:
1. Transcribe ONLY the exact spoken words verbatim into short, single-line \`subtitles\`.
2. Write a catchy \`title\`, \`caption\`, and \`hashtags\` based STRICTLY on what is actually spoken in THIS audio clip.

STRICT TRANSCRIPTION RULES:
- Transcribe word-for-word with natural, grammatically accurate spelling (e.g., never mishear "he looks tall" as "he's looks tall"). NEVER invent or guess words that were not spoken.
- If there is silence or no speech, leave a gap — do NOT fill silence with fake text.
- Keep each subtitle cue very short (${wordsPerCue}) so it renders cleanly on ONE crisp line without wrapping into a giant block.
- Set accurate \`start\` and \`end\` timestamps in seconds from \`0.0\` to \`${clipDuration.toFixed(1)}\`, aligned tightly to when each phrase is spoken.

Return ONLY valid JSON:
{
  "title": "Catchy 4-7 word hook title matching this clip",
  "caption": "Scroll-stopping Instagram caption matching what is said (1-2 sentences + 1-2 emojis)",
  "hashtags": ["#reels", "#viral", "#fyp", "#trending"],
  "subtitles": [
    { "start": 0.4, "end": 1.6, "text": "Exact spoken words" }
  ]
}`;

  type SubPayload =
    | Partial<SubtitleCue>[]
    | {
        title?: string;
        caption?: string;
        hashtags?: string[];
        subtitles?: Partial<SubtitleCue>[];
      };

  const parsed = await callGeminiWithBudget<SubPayload>(
    apiKey,
    [
      {
        inlineData: {
          mimeType: "audio/mp3",
          data: audioBuf.toString("base64"),
        },
      },
      { text: prompt },
    ],
    Date.now() + 40_000,
    { temperature: 0.0, thinkingLevel: "LOW", maxOutputTokens: 3200 },
    (payload) => {
      if (Array.isArray(payload)) return true;
      return Boolean(payload && Array.isArray(payload.subtitles));
    },
  );

  const rawSubs = Array.isArray(parsed) ? parsed : (parsed.subtitles ?? []);
  let subtitles = normalizeSubtitles(rawSubs, clipDuration, captionStyle);

  // Snap dead intro silence if the first spoken word starts > 1.5s in and enough clip remains.
  let trimStartOffset = 0;
  if (subtitles.length > 0 && subtitles[0].start > 1.5 && clipDuration - subtitles[0].start >= 14) {
    trimStartOffset = Math.floor(subtitles[0].start - 0.3);
    subtitles = subtitles.map((cue) => ({
      start: Number(Math.max(0, cue.start - trimStartOffset).toFixed(2)),
      end: Number(Math.max(0.4, cue.end - trimStartOffset).toFixed(2)),
      text: cue.text,
    }));
  }

  if (Array.isArray(parsed)) {
    return { subtitles, trimStartOffset };
  }

  return {
    subtitles,
    trimStartOffset,
    title: parsed.title?.trim() || undefined,
    caption: parsed.caption?.trim() || undefined,
    hashtags:
      Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0
        ? parsed.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`))
        : undefined,
  };
}
