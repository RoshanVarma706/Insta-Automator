export type Source = "youtube" | "instagram" | "generic";

export type MockResult = {
  id: string;
  source: Source;
  title: string;
  caption: string;
  hashtags: string[];
  videoUrl: string;
  mediaId: string;
  duration: string;
  size: string;
  createdAt: string;
};

export const SOURCE_OPTIONS: { id: Source; label: string; hint: string }[] = [
  { id: "youtube", label: "YouTube", hint: "Shorts, clips, full videos" },
  { id: "instagram", label: "Instagram", hint: "Existing reels and posts" },
  { id: "generic", label: "Any link", hint: "Direct MP4 or other hosts" },
];

export const PIPELINE_STEPS = [
  {
    key: "detect",
    label: "Detect source & fetch video",
    detail: "Reading metadata from the link you pasted.",
  },
  {
    key: "caption",
    label: "Write caption & hashtags",
    detail: "Gemini turns the context into a scroll-stopping hook.",
  },
  {
    key: "reframe",
    label: "Reframe to 9:16",
    detail: "Cloudinary renders a 1080×1920 vertical version.",
  },
  {
    key: "prepare",
    label: "Create Instagram media",
    detail: "Uploading the rendered reel to Meta.",
  },
  {
    key: "publish",
    label: "Publish to Reels",
    detail: "Sending the final publish request.",
  },
] as const;

const CAPTIONS: Record<Source, { caption: string; hashtags: string[] }> = {
  youtube: {
    caption:
      "This clip had no business going this hard. Save it for the next time you need a reset.",
    hashtags: ["#reels", "#viral", "#fyp", "#trending", "#instagood"],
  },
  instagram: {
    caption:
      "Found the original and had to re-share it in the right format. Tag someone who needs this today.",
    hashtags: ["#reelsinstagram", "#explorepage", "#repost", "#creator", "#reels"],
  },
  generic: {
    caption:
      "One link in, one vertical reel out. This is what a clean workflow looks like.",
    hashtags: ["#automation", "#contentcreator", "#reels", "#workflow", "#buildinpublic"],
  },
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  if (source === "youtube") return `YouTube clip · ${host}`;
  if (source === "instagram") return `Instagram reel · ${host}`;
  return `Video · ${host}`;
}

export type PipelineInput = {
  url: string;
  source: Source;
  onStep?: (index: number) => void;
  isCancelled?: () => boolean;
};

/**
 * Simulates the full pipeline locally so the UI is fully usable without any
 * API keys. Swap this for a `fetch("/api/webhook")` call when the real
 * n8n / Gemini / Cloudinary pipeline is connected.
 */
export async function runMockPipeline({
  url,
  source,
  onStep,
  isCancelled,
}: PipelineInput): Promise<MockResult> {
  for (let index = 0; index < PIPELINE_STEPS.length; index += 1) {
    if (isCancelled?.()) {
      throw new Error("cancelled");
    }

    onStep?.(index);
    await sleep(650 + Math.random() * 550);
  }

  const template = CAPTIONS[source];
  const now = new Date();

  return {
    id: `clip_${now.getTime().toString(36)}`,
    source,
    title: makeTitle(source, url),
    caption: template.caption,
    hashtags: template.hashtags,
    videoUrl: `https://res.cloudinary.com/demo/video/upload/c_fill,w_1080,h_1920/sample_${now.getTime()}.mp4`,
    mediaId: `ig_${Math.floor(now.getTime() / 1000)}`,
    duration: "0:38",
    size: "1080 × 1920",
    createdAt: now.toISOString(),
  };
}
