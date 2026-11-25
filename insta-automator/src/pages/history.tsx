/* History Page — Polling logs and activity */
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function History() {
  const pathname = usePathname();
  const { toast } = useToast();

  // Mock history
  const [history, setHistory] = useState([
    { id: "1", action: "poll", status: "success", timestamp: "2:30 PM", details: "Clip rendered • 1080×1920" },
    { id: "2", action: "publish", status: "success", timestamp: "3:00 PM", details: "Published to Instagram • Media ID: ig_1702983456" },
    { id: "3", action: "error", status: "failed", timestamp: "3:30 PM", details: "Rate limit • Retrying in 15min" },
  ]);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = history.filter((h) => {
    if (filter !== "all" && h.status !== filter) return false;
    if (search && !h.details.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleFilter = (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  const deleteItem = (id: string) => {
    setHistory((h) => h.filter((x) => x.id !== id));
    toast({ title: "Cleared", description: "History entry removed", variant: "default" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="insta-ambient animate-inca-drift fixed inset-0 z-0 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filter"
                  value="all"
                  checked={filter === "all"}
                  onChange={handleFilter}
                  className="w-4 h-4 rounded bg-startswith([var(--insta-card)])_white border border-startswith([var(--insta-border)])_E4E6EB"
                />
                All
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filter"
                  value="success"
                  checked={filter === "success"}
                  onChange={handleFilter}
                  className="w-4 h-4 rounded bg-startswith([var(--insta-card)])_white border border-startswith([var(--insta-border)])_E4E6EB"
                />
                Success {history.filter((h) => h.status === "success").length}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filter"
                  value="failed"
                  checked={filter === "failed"}
                  onChange={handleFilter}
                  className="w-4 h-4 rounded bg-startswith([var(--insta-card)])_white border border-startswith([var(--insta-border)])_E4E6EB"
                />
                Failed {history.filter((h) => h.status === "failed").length}
              </label>
            </div>
            <Input
              placeholder="Search actions or details..."
              value={search}
              onChange={handleSearch}
              className="input-field w-full mb-3"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id} className="border-b border-startswith([var(--insta-border)])_E4E6EB">
                    <TableCell>{h.timestamp}</TableCell>
                    <TableCell>{h.action}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          h.status === "success" ? "text-insta-success" : "text-insta-warning"
                        )}>
                        {h.status}
                      </span>
                    </TableCell>
                    <TableCell>{h.details}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        className="p-1"
                        onClick={() => deleteItem(h.id)}
                        title="Clear"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              onClick={() => {
                setHistory([]);
                toast({ title: "Cleared", description: "All history removed", variant: "default" });
              }}
              className="mt-4 w-full text-sm text-insta-warning hover:text-startswith([var(--insta-warning)])_F8AA2A transition-colors"
            >
              Clear All History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}