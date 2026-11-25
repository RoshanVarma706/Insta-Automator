import { useState } from "react";
import { CheckCircle2, Clock3, Search, Trash2, XCircle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type HistoryStatus = "success" | "failed";
type Filter = "all" | HistoryStatus;

type HistoryRow = {
  id: string;
  action: string;
  status: HistoryStatus;
  timestamp: string;
  details: string;
};

const SEED: HistoryRow[] = [
  {
    id: "h1",
    action: "publish",
    status: "success",
    timestamp: "Today, 14:32",
    details: "Reel published · Media ID ig_1702983456",
  },
  {
    id: "h2",
    action: "render",
    status: "success",
    timestamp: "Today, 14:29",
    details: "Cloudinary reframed clip to 1080 × 1920",
  },
  {
    id: "h3",
    action: "poll",
    status: "success",
    timestamp: "Today, 14:25",
    details: "Media container ready · processing finished",
  },
  {
    id: "h4",
    action: "publish",
    status: "failed",
    timestamp: "Today, 13:58",
    details: "Rate limit reached · retry scheduled in 15 min",
  },
  {
    id: "h5",
    action: "caption",
    status: "success",
    timestamp: "Today, 13:55",
    details: "Gemini generated caption and 5 hashtags",
  },
];

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All activity" },
  { id: "success", label: "Successful" },
  { id: "failed", label: "Failed" },
];

export default function History() {
  const [rows, setRows] = useState<HistoryRow[]>(SEED);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const visible = rows.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    if (!search.trim()) return true;

    const needle = search.trim().toLowerCase();
    return (
      row.action.toLowerCase().includes(needle) ||
      row.details.toLowerCase().includes(needle) ||
      row.status.includes(needle)
    );
  });

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    toast({ title: "Entry removed", variant: "success" });
  }

  function clearAll() {
    if (rows.length === 0) return;
    setRows([]);
    toast({
      title: "History cleared",
      description: "All local activity entries were removed.",
      variant: "success",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">History</h1>
          <p className="mt-1 text-sm text-insta-muted">
            Every pipeline event, newest first. Stored locally in this browser.
          </p>
        </div>

        <Button variant="secondary" onClick={clearAll} disabled={rows.length === 0}>
          <Trash2 className="h-4 w-4" />
          Clear all
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>
            {rows.length} entr{rows.length === 1 ? "y" : "ies"} · {visible.length} shown
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-insta-bg p-1">
              {filters.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={filter === option.id}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    filter === option.id
                      ? "bg-white text-insta-text shadow-sm"
                      : "text-insta-muted hover:text-insta-text",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-insta-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search activity…"
                className="pl-9"
                aria-label="Search history"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-insta-border py-14 text-center">
              <Clock3 className="h-7 w-7 text-insta-muted/60" />
              <p className="text-sm font-semibold text-insta-text">Nothing here yet</p>
              <p className="max-w-xs text-xs text-insta-muted">
                Run a reel from the create page, or change the filter and search above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-insta-muted">
                      {row.timestamp}
                    </TableCell>
                    <TableCell className="font-semibold capitalize">{row.action}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                          row.status === "success"
                            ? "bg-insta-success/10 text-insta-success"
                            : "bg-insta-danger/10 text-insta-danger",
                        )}
                      >
                        {row.status === "success" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-insta-muted">{row.details}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-lg p-1.5 text-insta-muted transition hover:bg-insta-danger/10 hover:text-insta-danger"
                        aria-label={`Remove ${row.action} entry`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
