import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  Instagram,
  Link2,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
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
  PIPELINE_STEPS,
  SOURCE_OPTIONS,
  hostnameOf,
  isValidVideoUrl,
  type Source,
} from "@/lib/mock";
import {
  checkPipelineStatus,
  runRealPipeline,
  type PipelineResult,
  type PipelineStatus,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type RunStatus = "idle" | "running" | "done" | "error";

const sourceIcons: Record<Source, typeof Youtube> = {
  youtube: Youtube,
  instagram: Instagram,
  generic: Link2,
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<Source>("youtube");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    mode: "mock",
    igAccount: null,
  });
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const cancelled = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    cancelled.current = false;
    checkPipelineStatus().then((next) => {
      if (!cancelled.current) setPipelineStatus(next);
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
    setTouched(true);

    if (!urlIsValid) {
      setError("Paste a full link starting with http:// or https://");
      return;
    }

    cancelled.current = false;
    setError("");
    setResult(null);
    setStatus("running");
    setActiveStep(0);

    try {
      const output = await runRealPipeline({
        url,
        source,
        onStep: (index) => {
          if (!cancelled.current) setActiveStep(index);
        },
        isCancelled: () => cancelled.current,
      });

      if (cancelled.current) return;

      setResult(output);
      setStatus("done");
      setActiveStep(PIPELINE_STEPS.length - 1);
      toast({
        title: output.mode === "live" ? "Reel published!" : "Reel is ready",
        description:
          output.mode === "live"
            ? "Caption generated, 9:16 rendered, and published to Instagram Reels."
            : "Mock pipeline finished — caption, 9:16 render and publish simulated.",
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
    }
  }

  function reset() {
    cancelled.current = false;
    setStatus("idle");
    setActiveStep(-1);
    setResult(null);
    setError("");
    setUrl("");
    setTouched(false);
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
          Gemini + Cloudinary + Meta Graph API
        </span>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Turn any link into a{" "}
          <span className="gradient-text">vertical Reel</span>
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-insta-muted sm:text-base">
          Paste a video URL. Insta Auto writes the caption, reframes the footage to 9:16 and
          publishes it to Instagram — all tracked in one dashboard.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="animate-float-in overflow-hidden">
          <div className="gradient-rule" />
          <CardHeader>
            <CardTitle>New Instagram Reel</CardTitle>
            <CardDescription>
              {pipelineStatus.mode === "live"
                ? pipelineStatus.igAccount
                  ? `Connected to @${pipelineStatus.igAccount.username} (${pipelineStatus.igAccount.pageName}). Ready to publish.`
                  : "Live pipeline active — Gemini, Cloudinary & Meta Graph API."
                : "Mock mode is on — deploy to Vercel with API keys or run `vercel dev` to go live."}
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
                placeholder="https://www.youtube.com/watch?v=..."
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
                  : "YouTube, Instagram or any direct video link."}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-insta-muted">
                Source type
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleGenerate}
                disabled={status === "running"}
                className="w-full sm:flex-1"
              >
                {status === "running" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running pipeline…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Reel
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
              <Alert variant="destructive" title="Check the link">
                {error}
              </Alert>
            ) : null}

            {status !== "idle" ? (
              <div className="space-y-4 rounded-2xl border border-insta-border bg-insta-bg/50 p-4">
                <Progress value={progress} label="Pipeline progress" />

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
          {result ? (
            <Card className="animate-float-in overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Ready to publish</CardTitle>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-insta-success/10 px-2.5 py-1 text-xs font-semibold text-insta-success">
                    <Check className="h-3.5 w-3.5" />
                    Published
                  </span>
                </div>
                <CardDescription>{result.title}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,#e1306c,#fd1f1f_55%,#a855f7)]">
                  {result.mode === "live" && result.videoUrl ? (
                    <video
                      src={result.videoUrl}
                      controls
                      playsInline
                      className="aspect-[9/16] max-h-72 w-full bg-black object-contain"
                    />
                  ) : (
                    <div className="flex aspect-[9/16] max-h-64 w-full items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 text-[11px] font-medium text-white">
                    {result.size} · {result.duration} ·{" "}
                    {result.mode === "live" ? "9:16 Cloudinary render" : "mock render"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-insta-muted">
                      Caption
                    </p>
                    <button
                      type="button"
                      onClick={() => copy(result.caption, "Caption")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-insta-primary hover:underline"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                  <p className="rounded-lg bg-insta-bg p-3 text-sm leading-relaxed text-insta-text">
                    {result.caption}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-insta-muted">
                    Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-insta-accent/10 px-2.5 py-1 text-xs font-semibold text-insta-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-insta-muted">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-insta-border px-3 py-2">
                    <span>Media ID</span>
                    <span className="truncate font-mono text-insta-text">{result.mediaId}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-insta-border px-3 py-2">
                    <span>Cloudinary asset</span>
                    <span className="truncate font-mono text-insta-text">{result.id}</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => copy(`${result.caption}\n\n${result.hashtags.join(" ")}`, "Post")}
                >
                  <Copy className="h-4 w-4" />
                  Copy caption + hashtags
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What happens next</CardTitle>
                <CardDescription>Five automated steps, one click.</CardDescription>
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
              <CardTitle className="text-base">Already have reels?</CardTitle>
              <CardDescription>See every job and its status.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/dashboard"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-insta-border px-5 text-sm font-semibold text-insta-text transition hover:bg-white"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
