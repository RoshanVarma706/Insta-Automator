import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Download,
  Film,
  Instagram,
  Link2,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Subtitles,
  Trash2,
  Tv,
  Youtube,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  useToast,
} from "@/components/ui";
import {
  ASPECT_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  PIPELINE_STEPS,
  SOURCE_OPTIONS,
  hostnameOf,
  isValidVideoUrl,
  type AspectMode,
  type CaptionStyle,
  type Source,
} from "@/lib/mock";
import {
  checkPipelineStatus,
  deleteRecentClip,
  fetchLibraryData,
  formatTimestamp,
  publishClipToInstagram,
  runRealPipeline,
  type GeneratedReel,
  type PipelineStatus,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type RunStatus = "idle" | "running" | "done" | "error";

const sourceIcons: Record<Source, typeof Youtube> = {
  twitch: Tv,
  youtube: Youtube,
  instagram: Instagram,
  generic: Link2,
};

const COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;
const DURATION_OPTIONS = [
  { value: 30, label: "30 sec", hint: "Snappy hook" },
  { value: 45, label: "45 sec", hint: "Balanced story" },
  { value: 60, label: "60 sec", hint: "Deep highlight" },
] as const;

export default function Home() {
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get("url") || "";
  const [url, setUrl] = useState(initialUrl);
  const [source, setSource] = useState<Source>(() =>
    initialUrl.includes("youtube") || initialUrl.includes("youtu.be")
      ? "youtube"
      : initialUrl.includes("instagram")
        ? "instagram"
        : initialUrl && !initialUrl.includes("twitch")
          ? "generic"
          : "twitch",
  );
  const [clipCount, setClipCount] = useState<number>(1);
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [aspectMode, setAspectMode] = useState<AspectMode>("9:16-16:9");
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("viral");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [usedCachedSource, setUsedCachedSource] = useState(false);
  const [results, setResults] = useState<GeneratedReel[]>([]);
  const [recentClips, setRecentClips] = useState<GeneratedReel[]>([]);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    configured: true,
    igAccount: null,
  });
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const cancelled = useRef(false);
  const runningRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    cancelled.current = false;
    checkPipelineStatus().then((next) => {
      if (!cancelled.current) setPipelineStatus(next);
    });
    fetchLibraryData().then((data) => {
      if (!cancelled.current) setRecentClips(data.clips.slice(0, 6));
    });
    return () => {
      cancelled.current = true;
    };
  }, []);

  const urlIsValid = isValidVideoUrl(url);
  const progress =
    status === "done"
      ? 100
      : status === "running"
        ? Math.round(((activeStep + 1) / PIPELINE_STEPS.length) * 100)
        : 0;

  async function handleGenerate() {
    if (runningRef.current) return;
    setTouched(true);

    if (!urlIsValid) {
      setError("Paste a full link starting with http:// or https://");
      return;
    }

    runningRef.current = true;
    cancelled.current = false;
    setError("");
    setUsedCachedSource(false);
    setResults([]);
    setStatus("running");
    setActiveStep(0);

    try {
      const output = await runRealPipeline({
        url,
        source,
        count: clipCount,
        targetDuration,
        aspectMode,
        captionsEnabled,
        captionStyle,
        onStep: (index, meta) => {
          if (!cancelled.current) {
            setActiveStep(index);
            if (meta?.cached) setUsedCachedSource(true);
          }
        },
        isCancelled: () => cancelled.current,
      });

      if (cancelled.current) return;

      setResults(output);
      setRecentClips((prev) => [...output, ...prev].slice(0, 6));
      setStatus("done");
      setActiveStep(PIPELINE_STEPS.length - 1);
      toast({
        title: `${output.length} viral clip${output.length === 1 ? "" : "s"} ready!`,
        description: output[0]?.cachedSource
          ? "Reused downloaded video — new clips rendered without re-downloading."
          : "Clips rendered with clean captions & hashtags.",
        variant: "success",
      });
    } catch (err) {
      if (cancelled.current) return;
      setStatus("error");
      const message =
        err instanceof Error && err.message && err.message !== "cancelled"
          ? err.message
          : "Something interrupted the pipeline. Try again.";
      setError(message);
    } finally {
      runningRef.current = false;
    }
  }

  async function handlePublish(reel: GeneratedReel) {
    setPublishingId(reel.id);
    try {
      const published = await publishClipToInstagram(reel);
      setResults((prev) =>
        prev.map((item) =>
          item.id === reel.id
            ? { ...item, mediaId: published.mediaId, containerId: published.containerId }
            : item,
        ),
      );
      toast({
        title: "Published to Instagram Reels!",
        description: `Media ID: ${published.mediaId}`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Instagram publish failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setPublishingId(null);
    }
  }

  function reset() {
    cancelled.current = false;
    setStatus("idle");
    setActiveStep(-1);
    setUsedCachedSource(false);
    setResultState();
  }

  function setResultState() {
    setResults([]);
    setError("");
    setUrl("");
    setTouched(false);
  }

  async function handleDeleteClip(id: string) {
    setDeletingClipId(id);
    try {
      await deleteRecentClip(id);
      setResults((prev) => prev.filter((c) => c.id !== id));
      setRecentClips((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Clip deleted", variant: "success" });
    } catch (err) {
      toast({
        title: "Failed to delete clip",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDeletingClipId(null);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, variant: "success" });
    } catch {
      toast({
        title: "Clipboard blocked",
        description: "Select the text and copy it manually.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-8">
      <section className="animate-float-in text-center sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-insta-border bg-white/70 px-3 py-1.5 text-xs font-semibold text-insta-muted">
          <Sparkles className="h-3.5 w-3.5 text-insta-primary" />
          Twitch · YouTube · Gemini Viral Clipping · Cloudinary 9:16
        </span>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Turn any link into{" "}
          <span className="gradient-text">viral 9:16 clips</span>
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-insta-muted sm:text-base">
          Paste a Twitch, YouTube, or video URL. Choose how many clips and the target duration —
          Gemini identifies the most viral moments with strong hooks and clean endings, then
          renders 1080×1920 vertical clips ready to download or publish.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="animate-float-in overflow-hidden">
          <div className="gradient-rule" />
          <CardHeader>
            <CardTitle>Generate Reel</CardTitle>
            <CardDescription>
              {pipelineStatus.configured
                ? "Live clipping pipeline active — Twitch, YouTube & direct video links."
                : pipelineStatus.error || "Configure GEMINI_API_KEY and CLOUDINARY_URL to run."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label
                htmlFor="video-url"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-insta-muted"
              >
                Video link
              </label>
              <Input
                id="video-url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) setError("");
                }}
                onBlur={() => setTouched(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && status !== "running") handleGenerate();
                }}
                placeholder="https://www.twitch.tv/videos/... or youtube.com/watch?v=..."
                disabled={status === "running"}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={touched && !urlIsValid}
                aria-describedby="video-url-help"
                className={cn(touched && !url && "border-insta-danger/60")}
              />
              <p id="video-url-help" className="mt-1.5 text-xs text-insta-muted">
                {url && urlIsValid
                  ? `Detected host: ${hostnameOf(url)}`
                  : "Twitch VODs/Clips, YouTube, Instagram or any direct video link."}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-insta-muted">
                Source type
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SOURCE_OPTIONS.map((option) => {
                  const Icon = sourceIcons[option.id];
                  const selected = source === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSource(option.id)}
                      disabled={status === "running"}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-60",
                        selected
                          ? "border-insta-primary/50 bg-insta-primary/5 ring-1 ring-insta-primary/20"
                          : "border-insta-border bg-white hover:border-insta-primary/30",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          selected ? "text-insta-primary" : "text-insta-muted",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-insta-text">
                          {option.label}
                        </span>
                        <span className="block text-xs leading-snug text-insta-muted">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-insta-muted">
                  <Film className="h-3.5 w-3.5 text-insta-primary" />
                  How many Reels / Shorts
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {COUNT_OPTIONS.map((num) => {
                    const selected = clipCount === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setClipCount(num)}
                        disabled={status === "running"}
                        aria-pressed={selected}
                        className={cn(
                          "h-11 rounded-xl border text-sm font-bold transition disabled:opacity-60",
                          selected
                            ? "border-insta-primary/50 bg-insta-primary/10 text-insta-primary ring-1 ring-insta-primary/20"
                            : "border-insta-border bg-white text-insta-text hover:border-insta-primary/30",
                        )}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-insta-muted">
                  Gemini picks the top {clipCount} viral moment{clipCount === 1 ? "" : "s"}.
                </p>
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-insta-muted">
                  <Clock className="h-3.5 w-3.5 text-insta-primary" />
                  Clip duration
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => {
                    const selected = targetDuration === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTargetDuration(opt.value)}
                        disabled={status === "running"}
                        aria-pressed={selected}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border py-2 text-center transition disabled:opacity-60",
                          selected
                            ? "border-insta-primary/50 bg-insta-primary/10 text-insta-primary ring-1 ring-insta-primary/20"
                            : "border-insta-border bg-white text-insta-text hover:border-insta-primary/30",
                        )}
                      >
                        <span className="text-sm font-bold">{opt.label}</span>
                        <span className="text-[10px] text-insta-muted">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-insta-muted">
                  {targetDuration >= 60
                    ? "Strong opening hook & finishes within 60s max."
                    : `Targets ${targetDuration}s, extends slightly for a clean ending.`}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-insta-muted">
                Video layout &amp; aspect ratio
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {ASPECT_OPTIONS.map((opt) => {
                  const selected = aspectMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAspectMode(opt.id)}
                      disabled={status === "running"}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
                        selected
                          ? "border-insta-primary/50 bg-insta-primary/5 ring-1 ring-insta-primary/20"
                          : "border-insta-border bg-white hover:border-insta-primary/30",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-insta-bg"
                      >
                        {opt.id === "9:16" ? (
                          <span className="h-6 w-3.5 rounded-[3px] border-2 border-current text-insta-primary" />
                        ) : opt.id === "16:9" ? (
                          <span className="h-3.5 w-6 rounded-[3px] border-2 border-current text-insta-primary" />
                        ) : (
                          <span className="flex h-6 w-3.5 items-center justify-center rounded-[3px] border border-insta-primary/60 bg-insta-primary/15">
                            <span className="h-2 w-3 rounded-[1px] bg-insta-primary" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-insta-text">
                          {opt.label}
                        </span>
                        <span className="block text-xs leading-snug text-insta-muted">
                          {opt.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-insta-border bg-white/80 p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-insta-primary/10 text-insta-primary">
                    <Subtitles className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-insta-text">
                      Burned-in on-screen captions
                    </p>
                    <p className="text-xs leading-snug text-insta-muted">
                      {captionsEnabled
                        ? aspectMode === "9:16-16:9"
                          ? "Top viral hook + verbatim synced captions placed cleanly below the 16:9 video."
                          : "Verbatim speech captions placed in the safe lower viewing zone."
                        : "Disabled — clean video with no text overlays."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={captionsEnabled}
                  aria-label="Toggle burned-in on-screen captions"
                  disabled={status === "running"}
                  onClick={() => setCaptionsEnabled((v) => !v)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60",
                    captionsEnabled
                      ? "bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)]"
                      : "bg-insta-border",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                      captionsEnabled ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>

              {captionsEnabled ? (
                <div className="border-t border-insta-border/70 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-insta-muted">
                    Caption type
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {CAPTION_STYLE_OPTIONS.map((styleOpt) => {
                      const selected = captionStyle === styleOpt.id;
                      return (
                        <button
                          key={styleOpt.id}
                          type="button"
                          onClick={() => setCaptionStyle(styleOpt.id)}
                          disabled={status === "running"}
                          aria-pressed={selected}
                          className={cn(
                            "flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition disabled:opacity-60",
                            selected
                              ? "border-insta-primary/50 bg-insta-primary/5 ring-1 ring-insta-primary/20"
                              : "border-insta-border bg-white hover:border-insta-primary/30",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-[10px] tracking-wide",
                              styleOpt.previewBg,
                              styleOpt.previewText,
                            )}
                          >
                            Aa Caption
                          </span>
                          <span>
                            <span className="block text-xs font-semibold text-insta-text">
                              {styleOpt.label}
                            </span>
                            <span className="block text-[11px] leading-snug text-insta-muted">
                              {styleOpt.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleGenerate}
                disabled={status === "running"}
                className="w-full sm:flex-1"
              >
                {status === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Clipping &amp; reframing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate {clipCount} Clip{clipCount === 1 ? "" : "s"} ({targetDuration}s)
                  </>
                )}
              </Button>

              {status !== "idle" ? (
                <Button variant="secondary" onClick={reset} className="sm:w-auto">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              ) : null}
            </div>

            {error ? (
              <Alert variant="destructive" title="Pipeline error">
                {error}
              </Alert>
            ) : null}

            {status !== "idle" ? (
              <div className="space-y-4 rounded-2xl border border-insta-border bg-insta-bg/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Progress value={progress} label="Clipping progress" className="flex-1" />
                  {usedCachedSource ? (
                    <span className="shrink-0 rounded-full bg-insta-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-insta-success">
                      Reused downloaded video
                    </span>
                  ) : null}
                </div>

                <ol className="space-y-3">
                  {PIPELINE_STEPS.map((step, index) => {
                    const complete = status === "done" || index < activeStep;
                    const current = status === "running" && index === activeStep;

                    return (
                      <li key={step.key} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                            complete
                              ? "border-insta-success/40 bg-insta-success/10 text-insta-success"
                              : current
                                ? "border-insta-primary/40 bg-insta-primary/10 text-insta-primary"
                                : "border-insta-border bg-white text-insta-muted",
                          )}
                        >
                          {complete ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : current ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block text-sm font-semibold",
                              complete || current ? "text-insta-text" : "text-insta-muted",
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="block text-xs leading-snug text-insta-muted">
                            {step.detail}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {results.length > 0 ? (
            results.map((reel, idx) => (
              <Card key={reel.id} className="animate-float-in overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      Clip #{idx + 1} · {reel.title}
                    </CardTitle>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-insta-success/10 px-2.5 py-1 text-xs font-semibold text-insta-success">
                      <Check className="h-3.5 w-3.5" />
                      {reel.mediaId ? "Published" : "Clip ready"}
                    </span>
                    <button
                      type="button"
                      disabled={deletingClipId === reel.id}
                      onClick={() => handleDeleteClip(reel.id)}
                      className="rounded-lg p-1.5 text-insta-muted transition hover:bg-insta-danger/10 hover:text-insta-danger disabled:opacity-50"
                      aria-label={`Delete ${reel.title}`}
                      title="Delete clip"
                    >
                      {deletingClipId === reel.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <CardDescription>
                    {formatTimestamp(reel.startSeconds)} – {formatTimestamp(reel.endSeconds)} (
                    {reel.durationSeconds}s) · {reel.format}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl bg-black">
                    <video
                      src={reel.videoUrl}
                      controls
                      playsInline
                      preload="auto"
                      className={cn(
                        "w-full object-contain",
                        reel.aspectMode === "16:9" ? "aspect-video max-h-56" : "aspect-[9/16] max-h-72",
                      )}
                    />
                  </div>

                  <div className="rounded-lg border border-insta-primary/20 bg-insta-primary/5 p-3 text-xs leading-relaxed text-insta-text">
                    <span className="font-semibold text-insta-primary">Viral hook: </span>
                    {reel.hookReason}
                  </div>

                  {reel.subtitles.length > 0 ? (
                    <details className="rounded-lg border border-insta-border bg-white/70 p-3 text-xs">
                      <summary className="cursor-pointer font-semibold text-insta-text">
                        On-screen captions ({reel.subtitles.length} synced cues
                        {reel.captionsBurned ? " · burned into video" : ""})
                      </summary>
                      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-insta-muted">
                        {reel.subtitles.map((cue, cueIdx) => (
                          <li key={cueIdx} className="flex gap-2">
                            <span className="shrink-0 font-mono text-[11px] text-insta-primary">
                              {cue.start.toFixed(1)}s–{cue.end.toFixed(1)}s
                            </span>
                            <span className="text-insta-text">{cue.text}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-insta-muted">
                        Caption
                      </p>
                      <button
                        type="button"
                        onClick={() => copy(reel.caption, "Caption")}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-insta-primary hover:underline"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                    <p className="rounded-lg bg-insta-bg p-3 text-sm leading-relaxed text-insta-text">
                      {reel.caption}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-insta-muted">
                      Hashtags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {reel.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-insta-accent/10 px-2.5 py-1 text-xs font-semibold text-insta-accent"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <a
                      href={reel.videoUrl}
                      download={`${reel.title.replace(/[^a-z0-9]+/gi, "_")}.mp4`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-insta-border bg-white px-4 text-xs font-semibold text-insta-text transition hover:bg-insta-bg"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download {reel.aspectMode === "16:9" ? "16:9" : "9:16"} MP4
                    </a>

                    <Button
                      variant="secondary"
                      className="h-10 text-xs"
                      onClick={() => copy(`${reel.caption}\n\n${reel.hashtags.join(" ")}`, "Post")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy post text
                    </Button>
                  </div>

                  {reel.mediaId ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-insta-success/30 bg-insta-success/5 px-3 py-2 text-xs">
                      <span className="font-semibold text-insta-success">Instagram Media ID</span>
                      <span className="truncate font-mono text-insta-text">{reel.mediaId}</span>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={publishingId === reel.id}
                      onClick={() => handlePublish(reel)}
                    >
                      {publishingId === reel.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Publishing to Instagram…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Publish to Instagram Reels
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What happens next</CardTitle>
                <CardDescription>Four automated clipping steps, one click.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {PIPELINE_STEPS.map((step, index) => (
                    <li key={step.key} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-insta-bg text-xs font-bold text-insta-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-insta-text">{step.label}</p>
                        <p className="text-xs leading-snug text-insta-muted">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Recent clips</CardTitle>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-insta-primary hover:underline"
                >
                  Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <CardDescription>
                {recentClips.length > 0
                  ? "Delete old clips or reuse cached videos from Dashboard."
                  : "See every downloaded source and generated clip."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentClips.length > 0 ? (
                recentClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-insta-border px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-insta-text">{clip.title}</p>
                      <p className="text-[11px] text-insta-muted">
                        {formatTimestamp(clip.startSeconds)} – {formatTimestamp(clip.endSeconds)} (
                        {clip.durationSeconds}s)
                      </p>
                    </div>
                    <a
                      href={clip.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-semibold text-insta-primary hover:underline"
                    >
                      Watch
                    </a>
                    <button
                      type="button"
                      disabled={deletingClipId === clip.id}
                      onClick={() => handleDeleteClip(clip.id)}
                      className="rounded-lg p-1 text-insta-muted transition hover:bg-insta-danger/10 hover:text-insta-danger disabled:opacity-50"
                      aria-label={`Delete recent clip ${clip.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <Link
                  to="/dashboard"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-insta-border px-5 text-sm font-semibold text-insta-text transition hover:bg-white"
                >
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
