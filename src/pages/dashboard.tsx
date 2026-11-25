import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Film,
  Instagram,
  Link2,
  Plus,
  TrendingUp,
  Youtube,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { Source } from "@/lib/mock";
import { cn } from "@/lib/utils";

type SourceStatus = "completed" | "processing" | "queued";

type SourceRow = {
  id: string;
  title: string;
  host: string;
  type: Source;
  status: SourceStatus;
  clips: number;
};

type ClipRow = {
  id: string;
  title: string;
  source: string;
  format: string;
  status: "published" | "rendered" | "scheduled";
  createdAt: string;
};

const SOURCES: SourceRow[] = [
  {
    id: "src_1",
    title: "Street food in 60 seconds",
    host: "youtube.com",
    type: "youtube",
    status: "completed",
    clips: 4,
  },
  {
    id: "src_2",
    title: "Studio dance trend",
    host: "instagram.com",
    type: "instagram",
    status: "processing",
    clips: 2,
  },
  {
    id: "src_3",
    title: "Product teaser cut",
    host: "cdn.example.com",
    type: "generic",
    status: "completed",
    clips: 3,
  },
  {
    id: "src_4",
    title: "Weekly vlog highlights",
    host: "youtube.com",
    type: "youtube",
    status: "queued",
    clips: 0,
  },
];

const CLIPS: ClipRow[] = [
  {
    id: "clip_1",
    title: "Hook: 3 dishes you can't miss",
    source: "Street food in 60 seconds",
    format: "1080 × 1920",
    status: "published",
    createdAt: "Today, 14:32",
  },
  {
    id: "clip_2",
    title: "Dance break — alt take",
    source: "Studio dance trend",
    format: "1080 × 1920",
    status: "rendered",
    createdAt: "Today, 13:58",
  },
  {
    id: "clip_3",
    title: "Teaser — 15s cut",
    source: "Product teaser cut",
    format: "1080 × 1920",
    status: "published",
    createdAt: "Yesterday, 18:11",
  },
  {
    id: "clip_4",
    title: "Vlog cold open",
    source: "Weekly vlog highlights",
    format: "1080 × 1920",
    status: "scheduled",
    createdAt: "Yesterday, 09:24",
  },
];

const sourceIcons: Record<Source, typeof Youtube> = {
  youtube: Youtube,
  instagram: Instagram,
  generic: Link2,
};

const sourceTone: Record<Source, string> = {
  youtube: "bg-insta-secondary/10 text-insta-secondary",
  instagram: "bg-insta-primary/10 text-insta-primary",
  generic: "bg-insta-accent/10 text-insta-accent",
};

const statusTone: Record<SourceStatus, string> = {
  completed: "bg-insta-success/10 text-insta-success",
  processing: "bg-insta-warning/10 text-insta-warning",
  queued: "bg-insta-muted/10 text-insta-muted",
};

const clipTone: Record<ClipRow["status"], string> = {
  published: "bg-insta-success/10 text-insta-success",
  rendered: "bg-insta-accent/10 text-insta-accent",
  scheduled: "bg-insta-warning/10 text-insta-warning",
};

export default function Dashboard() {
  const totalClips = SOURCES.reduce((sum, source) => sum + source.clips, 0);
  const published = CLIPS.filter((clip) => clip.status === "published").length;

  const stats = [
    {
      label: "Active sources",
      value: String(SOURCES.length),
      hint: "2 platforms connected",
      icon: Film,
      tone: "text-insta-primary bg-insta-primary/10",
    },
    {
      label: "Clips generated",
      value: String(totalClips),
      hint: "Across all sources",
      icon: TrendingUp,
      tone: "text-insta-accent bg-insta-accent/10",
    },
    {
      label: "Published",
      value: String(published),
      hint: "Live on Instagram",
      icon: CheckCircle2,
      tone: "text-insta-success bg-insta-success/10",
    },
    {
      label: "Avg. approval",
      value: "92%",
      hint: "Last 30 days",
      icon: Clock3,
      tone: "text-insta-warning bg-insta-warning/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-insta-muted">
            A quick read on your sources, renders and published reels.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          New reel
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} className="card-hover">
              <CardContent className="flex items-start justify-between gap-3 p-5 pt-5 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-insta-muted">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-insta-muted">{stat.hint}</p>
                </div>
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", stat.tone)}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Videos currently feeding the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {SOURCES.map((source) => {
              const Icon = sourceIcons[source.type];

              return (
                <div
                  key={source.id}
                  className="flex items-center gap-3 rounded-xl border border-insta-border px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      sourceTone[source.type],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-insta-text">{source.title}</p>
                    <p className="truncate text-xs text-insta-muted">
                      {source.host} · {source.clips} clip{source.clips === 1 ? "" : "s"}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                      statusTone[source.status],
                    )}
                  >
                    {source.status}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent clips</CardTitle>
            <CardDescription>Newest renders from the pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Clip</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CLIPS.map((clip) => (
                  <TableRow key={clip.id}>
                    <TableCell>
                      <p className="font-semibold text-insta-text">{clip.title}</p>
                      <p className="text-xs text-insta-muted">
                        {clip.source} · {clip.format}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                          clipTone[clip.status],
                        )}
                      >
                        {clip.status}
                      </span>
                      <p className="mt-1 text-[11px] text-insta-muted">{clip.createdAt}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href="https://www.instagram.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-insta-primary hover:underline"
                      >
                        View
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
