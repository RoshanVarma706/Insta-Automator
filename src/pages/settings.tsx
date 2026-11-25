import { useEffect, useState } from "react";
import {
  Cloud,
  Database,
  Instagram,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
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
  useToast,
} from "@/components/ui";
import { checkPipelineStatus, type PipelineStatus } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type SettingsState = {
  autoPublish: boolean;
  dailyCap: number;
  spacingMinutes: number;
  minConfidence: number;
};

const STORAGE_KEY = "insta-auto:settings";

const DEFAULTS: SettingsState = {
  autoPublish: false,
  dailyCap: 10,
  spacingMinutes: 15,
  minConfidence: 85,
};

function loadSettings(): SettingsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      autoPublish: Boolean(parsed.autoPublish ?? DEFAULTS.autoPublish),
      dailyCap: Number(parsed.dailyCap ?? DEFAULTS.dailyCap),
      spacingMinutes: Number(parsed.spacingMinutes ?? DEFAULTS.spacingMinutes),
      minConfidence: Number(parsed.minConfidence ?? DEFAULTS.minConfidence),
    };
  } catch {
    return DEFAULTS;
  }
}

const integrations: { name: string; role: string; icon: LucideIcon; tone: string }[] = [
  {
    name: "Gemini",
    role: "Captions and hashtags",
    icon: Sparkles,
    tone: "bg-insta-primary/10 text-insta-primary",
  },
  {
    name: "Cloudinary",
    role: "9:16 render and hosting",
    icon: Cloud,
    tone: "bg-insta-accent/10 text-insta-accent",
  },
  {
    name: "Meta Graph API",
    role: "Instagram Reels publishing",
    icon: Instagram,
    tone: "bg-insta-secondary/10 text-insta-secondary",
  },
  {
    name: "Supabase",
    role: "Jobs, clips and sources",
    icon: Database,
    tone: "bg-insta-success/10 text-insta-success",
  },
];

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    configured: false,
    igAccount: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    checkPipelineStatus().then((next) => {
      if (active) setPipelineStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    const cleaned: SettingsState = {
      autoPublish: settings.autoPublish,
      dailyCap: Math.min(50, Math.max(1, Math.round(settings.dailyCap) || 1)),
      spacingMinutes: Math.min(720, Math.max(5, Math.round(settings.spacingMinutes) || 5)),
      minConfidence: Math.min(100, Math.max(0, Math.round(settings.minConfidence) || 0)),
    };

    setSettings(cleaned);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    toast({
      title: "Settings saved",
      description: "Stored locally in this browser.",
      variant: "success",
    });
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULTS);
    toast({ title: "Settings reset", description: "Back to the defaults." });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-insta-muted">
          Tune how the pipeline behaves. Values are saved in this browser only.
        </p>
      </div>

      {pipelineStatus.configured ? (
        <Alert variant="success" title="Live pipeline connected">
          {pipelineStatus.igAccount ? (
            <>
              Connected to Instagram{" "}
              <strong>@{pipelineStatus.igAccount.username}</strong> (ID:{" "}
              <code className="rounded bg-white/70 px-1">
                {pipelineStatus.igAccount.igUserId}
              </code>
              , Page: {pipelineStatus.igAccount.pageName}).
            </>
          ) : (
            <>
              Server-side API keys are active.{" "}
              {pipelineStatus.error
                ? `Instagram lookup note: ${pipelineStatus.error}`
                : ""}
            </>
          )}
        </Alert>
      ) : (
        <Alert variant="warning" title="API keys required">
          {pipelineStatus.error ||
            "Add GEMINI_API_KEY, CLOUDINARY_URL, and INSTAGRAM_ACCESS_TOKEN in .env or Vercel Environment Variables."}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Publishing preferences</CardTitle>
            <CardDescription>Guardrails that apply to every new reel.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-insta-border p-4">
              <div>
                <p className="text-sm font-semibold text-insta-text">Auto-publish</p>
                <p className="mt-0.5 text-xs leading-relaxed text-insta-muted">
                  Publish immediately when a reel passes review, instead of waiting for a manual
                  approval.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.autoPublish}
                aria-label="Toggle auto-publish"
                onClick={() => update("autoPublish", !settings.autoPublish)}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition",
                  settings.autoPublish
                    ? "bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)]"
                    : "bg-insta-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    settings.autoPublish ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="daily-cap"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-insta-muted"
                >
                  Daily upload cap
                </label>
                <Input
                  id="daily-cap"
                  type="number"
                  min={1}
                  max={50}
                  value={settings.dailyCap}
                  onChange={(event) => update("dailyCap", Number(event.target.value))}
                />
                <p className="mt-1 text-xs text-insta-muted">1 – 50 reels per day.</p>
              </div>

              <div>
                <label
                  htmlFor="spacing"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-insta-muted"
                >
                  Spacing between posts
                </label>
                <Input
                  id="spacing"
                  type="number"
                  min={5}
                  max={720}
                  value={settings.spacingMinutes}
                  onChange={(event) => update("spacingMinutes", Number(event.target.value))}
                />
                <p className="mt-1 text-xs text-insta-muted">Minutes between publishes.</p>
              </div>

              <div>
                <label
                  htmlFor="confidence"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-insta-muted"
                >
                  Minimum confidence
                </label>
                <Input
                  id="confidence"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.minConfidence}
                  onChange={(event) => update("minConfidence", Number(event.target.value))}
                />
                <p className="mt-1 text-xs text-insta-muted">
                  Reels below this score stay in review.
                </p>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-insta-muted">
                  Current mode
                </span>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-insta-border bg-insta-bg/60 px-3.5 text-sm font-semibold text-insta-text">
                  <ShieldCheck className="h-4 w-4 text-insta-success" />
                  {pipelineStatus.configured
                    ? pipelineStatus.igAccount
                      ? `Live (@${pipelineStatus.igAccount.username})`
                      : "Live (API keys active)"
                    : "Not configured"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-insta-border pt-4 sm:flex-row">
              <Button onClick={save} className="sm:flex-1">
                <Save className="h-4 w-4" />
                Save settings
              </Button>
              <Button variant="secondary" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>What powers the real pipeline.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {integrations.map((integration) => {
              const Icon = integration.icon;

              return (
                <div
                  key={integration.name}
                  className="flex items-center gap-3 rounded-xl border border-insta-border px-3 py-3"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      integration.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-insta-text">{integration.name}</p>
                    <p className="truncate text-xs text-insta-muted">{integration.role}</p>
                  </div>

                  <span className="shrink-0 rounded-full bg-insta-bg px-2.5 py-1 text-[11px] font-semibold text-insta-muted">
                    Server key
                  </span>
                </div>
              );
            })}

            <p className="pt-2 text-xs leading-relaxed text-insta-muted">
              Keys live only in Vercel environment variables. Never prefix them with{" "}
              <code className="rounded bg-insta-bg px-1">VITE_</code> — that would expose them to
              the browser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
