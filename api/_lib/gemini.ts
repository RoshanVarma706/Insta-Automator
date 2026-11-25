/**
 * Gemini API — caption and hashtag generation.
 * Uses the REST endpoint directly (no SDK dependency).
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export type CaptionResult = {
  caption: string;
  hashtags: string[];
};

export async function generateCaption(
  videoUrl: string,
  source: string,
): Promise<CaptionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const prompt = `You are a top-tier Instagram content strategist.
A user wants to publish a video as an Instagram Reel.

Video URL : ${videoUrl}
Source     : ${source}

Generate:
1. A short, scroll-stopping caption (1-2 sentences, with 1-2 relevant emojis).
2. 5-8 trending and relevant hashtags (each starting with #).

Respond ONLY with valid JSON — no markdown fences, no commentary:
{"caption":"…","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Extract the first JSON object from the response.
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON.");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<CaptionResult>;

  return {
    caption: parsed.caption || "Check this out! 🔥",
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
      : ["#reels", "#viral", "#fyp", "#trending", "#instagood"],
  };
}
