export type Source = "twitch" | "youtube" | "instagram" | "generic";
export type AspectMode = "9:16" | "16:9" | "9:16-16:9";
export type CaptionStyle = "viral" | "clean" | "neon" | "cinema";

export const ASPECT_OPTIONS: { id: AspectMode; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16 Portrait", hint: "Full vertical crop" },
  { id: "16:9", label: "16:9 Landscape", hint: "Full widescreen" },
  { id: "9:16-16:9", label: "9:16 w/ 16:9", hint: "Shorts blurred frame" },
];

export const CAPTION_STYLE_OPTIONS: {
  id: CaptionStyle;
  label: string;
  hint: string;
  previewBg: string;
  previewText: string;
}[] = [
  {
    id: "viral",
    label: "Viral Yellow",
    hint: "Bold uppercase pop",
    previewBg: "bg-black",
    previewText: "text-[#FFE600] font-extrabold uppercase",
  },
  {
    id: "clean",
    label: "Clean White",
    hint: "Crisp dark box",
    previewBg: "bg-black/80",
    previewText: "text-white font-bold",
  },
  {
    id: "neon",
    label: "Insta Pink",
    hint: "Creator highlight",
    previewBg: "bg-[#E1306C]",
    previewText: "text-white font-extrabold uppercase",
  },
  {
    id: "cinema",
    label: "Minimal Cinema",
    hint: "Subtle soft shade",
    previewBg: "bg-black/45",
    previewText: "text-slate-100 font-medium",
  },
];

export const SOURCE_OPTIONS: { id: Source; label: string; hint: string }[] = [
  { id: "twitch", label: "Twitch", hint: "VODs & stream clips" },
  { id: "youtube", label: "YouTube", hint: "Shorts, clips, full videos" },
  { id: "instagram", label: "Instagram", hint: "Existing reels and posts" },
  { id: "generic", label: "Any link", hint: "Direct MP4 or other hosts" },
];

export const PIPELINE_STEPS = [
  {
    key: "fetch",
    label: "Fetch & upload source video",
    detail: "Ingesting from Twitch, YouTube, or direct link into Cloudinary.",
  },
  {
    key: "analyze",
    label: "Gemini viral clip detection",
    detail: "Finding viral moments with strong start hooks and complete endings.",
  },
  {
    key: "transcribe",
    label: "Transcribe exact spoken captions",
    detail: "Extracting clip audio and syncing verbatim word-for-word subtitles.",
  },
  {
    key: "reframe",
    label: "Clip, format & burn captions",
    detail: "Trimming timestamps, rendering layout, and burning captions in position.",
  },
] as const;

export function isValidVideoUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostnameOf(value: string) {
  try {
    return new URL(value.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function makeTitle(source: Source, url: string) {
  const host = hostnameOf(url);
  if (source === "twitch") return `Twitch clip · ${host}`;
  if (source === "youtube") return `YouTube clip · ${host}`;
  if (source === "instagram") return `Instagram reel · ${host}`;
  return `Video · ${host}`;
}
