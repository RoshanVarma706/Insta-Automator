import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  Database,
  Film,
  HardDrive,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
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
  useToast,
} from "@/components/ui";
import {
  deleteDownloadedSource,
  deleteRecentClip,
  fetchLibraryData,
  formatTimestamp,
  type GeneratedReel,
  type StoredSource,
} from "@/lib/pipeline";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Dashboard() {
  const [clips, setClips] = useState<GeneratedReel[]>([]);
  const [sources, setSources] = useState<StoredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    fetchLibraryData()
      .then((data) => {
        if (!active) return;
        setClips(data.clips);
        setSources(data.sources);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteClip(id: string) {
    setBusyId(id);
    try {
      await deleteRecentClip(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Clip removed", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not delete clip",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteSource(publicId: string) {
    setBusyId(publicId);
    try {
      await deleteDownloadedSource(publicId);
      setSources((prev) => prev.filter((s) => s.publicId !== publicId));
      setClips((prev) => prev.filter((c) => c.publicId !== publicId));
      toast({
        title: "Downloaded source deleted",
        description: "Removed from Cloudinary cache & library.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Could not delete source",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  const totalStorage = sources.reduce((sum, s) => sum + (s.bytes || 0), 0);

  const stats = [
    {
      label: "Downloaded sources",
      value: String(sources.length),
      hint: "Cached for instant reuse",
      icon: Database,
      tone: "text-insta-primary bg-insta-primary/10",
    },
    {
      label: "Recent clips",
      value: String(clips.length),
      hint: "Ready to download or post",
      icon: Film,
      tone: "text-insta-accent bg-insta-accent/10",
    },
    {
      label: "Cache size",
      value: formatBytes(totalStorage),
      hint: "Stored in Cloudinary",
      icon: HardDrive,
      tone: "text-insta-success bg-insta-success/10",
    },
    {
      label: "Link matching",
      value: "Active",
      hint: "Same link skips download",
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
            Manage cached source videos and recent rendered clips.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          New clip
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
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Downloaded sources</CardTitle>
            <CardDescription>
              Re-pasting any of these links skips downloading and clips instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-insta-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading cached sources…
              </div>
            ) : sources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-insta-border py-10 text-center text-xs text-insta-muted">
                No downloaded sources yet. Generate a clip to cache its source video.
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.publicId}
                  className="flex items-center gap-3 rounded-xl border border-insta-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-insta-text">{src.title}</p>
                    <p className="truncate text-xs text-insta-muted">
                      {src.duration ? `${src.duration}s · ` : ""}
                      {formatBytes(src.bytes)} · {src.sourceUrl}
                    </p>
                  </div>

                  <Link
                    to={`/?url=${encodeURIComponent(src.sourceUrl)}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-insta-primary/10 px-2.5 py-1.5 text-xs font-semibold text-insta-primary transition hover:bg-insta-primary/15"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Reuse
                  </Link>

                  <button
                    type="button"
                    disabled={busyId === src.publicId}
                    onClick={() => handleDeleteSource(src.publicId)}
                    className="rounded-lg p-1.5 text-insta-muted transition hover:bg-insta-danger/10 hover:text-insta-danger disabled:opacity-50"
                    aria-label={`Delete source ${src.title}`}
                    title="Delete downloaded source from Cloudinary"
                  >
                    {busyId === src.publicId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent clips</CardTitle>
            <CardDescription>Watch, download, or delete rendered clips.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-insta-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading recent clips…
              </div>
            ) : clips.length === 0 ? (
              <div className="rounded-xl border border-dashed border-insta-border py-10 text-center text-xs text-insta-muted">
                No clips generated yet. Create your first clip from the Create page.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Clip</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clips.map((clip) => (
                    <TableRow key={clip.id}>
                      <TableCell>
                        <p className="font-semibold text-insta-text">{clip.title}</p>
                        <p className="text-xs text-insta-muted">{clip.format}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-insta-muted">
                        {formatTimestamp(clip.startSeconds)} – {formatTimestamp(clip.endSeconds)} (
                        {clip.durationSeconds}s)
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <a
                            href={clip.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-insta-primary hover:underline"
                          >
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            disabled={busyId === clip.id}
                            onClick={() => handleDeleteClip(clip.id)}
                            className="rounded-lg p-1.5 text-insta-muted transition hover:bg-insta-danger/10 hover:text-insta-danger disabled:opacity-50"
                            aria-label={`Delete ${clip.title}`}
                            title="Delete clip"
                          >
                            {busyId === clip.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
