/**
 * Gemini API — viral clip identification, timestamping, and captioning.
 *
 * Designed to stay well inside Vercel's serverless execution budget:
 *  - Uses MINIMAL thinking on Gemini 3 models for 3–5x faster responses.
 *  - Caps inline video proxy download at 14s and each Gemini call at 20s.
 *  - Enforces a 42s total wall-clock budget and falls back cleanly to fast
 *    metadata analysis instead of letting Vercel return a 504 timeout.
 */

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
] as const;

const TOTAL_BUDGET_MS = 42_000;

export type ViralClip = {
  title: string;
  startSeconds: number;
  endSeconds: number;
  hookReason: string;
  caption: string;
  hashtags: string[];
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

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
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
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseClipsJson(raw: string): { clips?: Partial<ViralClip>[] } | null {
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const direct = JSON.parse(trimmed) as { clips?: Partial<ViralClip>[] };
    if (direct && typeof direct === "object") return direct;
  } catch {
    // Fall through to balanced extractor
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted) as { clips?: Partial<ViralClip>[] };
  } catch {
    return null;
  }
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
      ? `4. DURATION HARD CAP (60s MAX): \`endSeconds - startSeconds\` MUST be between ${minDuration} and 60 seconds — NEVER exceed 60 seconds. Find a clean, complete ending at or just before the 60-second mark.`
      : `4. SMART FLEXIBLE ENDING DURATION: Target ~${targetDuration} seconds, and EXTEND the ending up to ${maxDuration} seconds (acceptable range: ${minDuration}–${maxDuration} seconds) whenever extra seconds are needed to reach a strong, clean, complete ending (e.g., if 30s is selected and the punchline finishes cleanly at 36s, end at 36s!). Never cut mid-sentence just to hit ${targetDuration}s.`;

  return `You are an expert short-form video editor and viral Reels strategist.
Identify the ${count} most viral, high-retention clip(s) from this video.

Video URL: ${videoUrl}
Source: ${source}
${titleHint}Requested clip count: ${count}
Preferred duration: ${targetDuration} seconds (allowed range: ${minDuration}–${maxDuration} seconds)
${durationHint}

CRITICAL CLIPPING RULES:
1. Identify the most famous, viral, emotionally engaging, or high-value moments (strong hooks, reveals, punchlines, clutch moments, or peak action).
2. STRONG STARTING POINT: Each \`startSeconds\` MUST begin cleanly at the start of a sentence, hook, or beat — NEVER mid-sentence or during dead air.
3. STRONG ENDING POINT: Each \`endSeconds\` MUST end cleanly at the completion of a thought, punchline, reveal, or natural pause — NEVER mid-word.
${endingRule}
5. NON-OVERLAPPING: Clips must cover distinct moments and must not overlap.
6. Rank from most viral to least viral.

Return ONLY valid JSON:
{
  "clips": [
    {
      "title": "Catchy 4-8 word clip title",
      "startSeconds": 12,
      "endSeconds": ${12 + targetDuration},
      "hookReason": "1 short sentence explaining why this clip will go viral and why the start/end points are strong",
      "caption": "Scroll-stopping caption (1-2 sentences + 1-2 emojis)",
      "hashtags": ["#reels", "#viral", "#fyp", "#trending", "#instagood"]
    }
  ]
}`;
}

async function callSingleGeminiModel(
  model: string,
  apiKey: string,
  parts: unknown[],
  timeoutMs: number,
): Promise<{ clips?: Partial<ViralClip>[] } | { error: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
  };

  if (model.startsWith("gemini-3")) {
    generationConfig.thinkingConfig = { thinkingLevel: "MINIMAL" };
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
      const parsed = parseClipsJson(chunk);
      if (parsed && Array.isArray(parsed.clips) && parsed.clips.length > 0) {
        return parsed;
      }
    }

    return { error: `${model} returned unparseable or empty clips JSON.` };
  } catch (err) {
    return {
      error: `${model}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function callGeminiWithBudget(
  apiKey: string,
  parts: unknown[],
  deadlineMs: number,
): Promise<{ clips?: Partial<ViralClip>[] }> {
  let lastError = "Gemini timed out.";

  for (const model of GEMINI_MODELS) {
    const remaining = deadlineMs - Date.now();
    if (remaining < 5000) break;

    const timeoutMs = Math.min(22_000, remaining - 1000);
    const result = await callSingleGeminiModel(model, apiKey, parts, timeoutMs);

    if ("clips" in result && result.clips) {
      return result;
    }
    if ("error" in result) {
      lastError = result.error;
    }
  }

  throw new Error(`Gemini API failed: ${lastError}`);
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

  return rawClips.slice(0, count).map((clip, index) => {
    let start = Math.max(0, Math.round(Number(clip.startSeconds) || index * targetDuration));
    let end = Math.round(Number(clip.endSeconds) || start + targetDuration);

    if (end <= start) {
      end = start + targetDuration;
    }

    if (end - start > maxDuration) {
      end = start + maxDuration;
    }

    if (maxVideoEnd < Number.MAX_SAFE_INTEGER) {
      if (maxVideoEnd <= targetDuration) {
        start = 0;
        end = Math.min(maxVideoEnd, maxDuration);
      } else {
        if (start >= maxVideoEnd - 5) {
          start = Math.max(0, maxVideoEnd - targetDuration);
        }
        end = Math.min(maxVideoEnd, end);
        if (end - start < 5) {
          start = Math.max(0, maxVideoEnd - targetDuration);
          end = Math.min(maxVideoEnd, start + maxDuration);
        }
      }
    }

    return {
      title: clip.title?.trim() || `Viral Clip #${index + 1}`,
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
    };
  });
}

async function fetchInlineVideoPart(
  analysisUrl: string,
  timeoutMs: number,
): Promise<unknown | null> {
  try {
    const res = await fetch(analysisUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 9 * 1024 * 1024) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 9 * 1024 * 1024) return null;
    return {
      inlineData: {
        mimeType: "video/mp4",
        data: buf.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Analyzes a video with Gemini and returns `count` viral clips with
 * strong start/end timestamps matching `targetDuration` (extending up to
 * +12s for 30s/45s to finish cleanly, and strictly <= 60s when 60s selected).
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
    // Cap proxy download to 14s so we always have plenty of budget left for Gemini.
    const inlinePart = await fetchInlineVideoPart(input.analysisUrl, 14_000);
    if (inlinePart) parts.push(inlinePart);
  }

  parts.push({ text: prompt });

  let parsed: { clips?: Partial<ViralClip>[] };
  try {
    // Reserve 8s at the end for a fast text-only fallback if video attempts 503/timeout.
    const videoDeadline = parts.length > 1 ? hardDeadline - 8_000 : hardDeadline;
    parsed = await callGeminiWithBudget(apiKey, parts, videoDeadline);
  } catch (err) {
    if (parts.length > 1 && hardDeadline - Date.now() >= 4_000) {
      parsed = await callGeminiWithBudget(apiKey, [{ text: prompt }], hardDeadline);
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
