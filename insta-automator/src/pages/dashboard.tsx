/* Dashboard Page — Overview of sources, clips, stats */
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useToast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const pathname = usePathname();
  const { toast } = useToast();

  // Mock data
  const [sources, setSources] = useState([
    { id: "1", title: "Funny Cats", url: "https://youtube.com/watch?v=abc", type: "youtube", status: "completed", clips: 5 },
    { id: "2", title: "Dance Reel", url: "https://instagram.com/reels/def", type: "instagram", status: "processing", clips: 2 },
  ]);

  const [clips, setClips] = useState([
    { id: "1", title: "Clip 1", source: "Funny Cats", status: "published", duration: "0:45" },
    { id: "2", title: "Clip 2", source: "Dance Reel", status: "rendered", duration: "1:22" },
  ]);

  const totalSources = sources.length;
  const totalClips = clips.length;
  const publishedClips = clips.filter(c => c.status === "published").length;

  useEffect(() => {
    // Poll data periodically
    const interval = setInterval(async () => {
      // In real app, fetch from Supabase
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="insta-ambient animate-inca-drift fixed inset-0 z-0 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="text-3xl font-bold text-insta-primary">{totalSources}</div>
                <div className="text-insta-muted text-sm">Sources</div>
              </Card>
              <Card className="p-4">
                <div className="text-3xl font-bold text-insta-secondary">{totalClips}</div>
                <div className="text-insta-muted text-sm">Clips</div>
              </Card>
              <Card className="p-4">
                <div className="text-3xl font-bold text-insta-success">{publishedClips}</div>
                <div className="text-insta-muted text-sm">Published</div>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>My Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${s.type === "youtube" ? "bg-startswith([var(--insta-primary)])_E1306C" : s.type === "instagram" ? "bg-startswith([var(--insta-secondary)])_FD1F1F" : "bg-startswith([var(--insta-accent)])_A855F7"}`}
                      />
                      <span className="text-insta-text font-medium">{s.title}</span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${s.status === "completed" ? "bg-startswith([rgba(63,187,133,0.1)])_3FBB85 text-3FBB85" : s.status === "processing" ? "bg-startswith([rgba(255,152,0,0.1)])_FF9800 text-FF9800" : "bg-startswith([rgba(248,170,42,0.1)])_F8AA2A text-F8AA2A"}`}>
                        {s.status}
                      </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Clips</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clip</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clips.map((c) => (
                      <TableRow key={c.id} className="border-b border-startswith([var(--insta-border)])_E4E6EB">
                        <TableCell>{c.title}</TableCell>
                        <TableCell>{c.source}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                              c.status === "published" ? "text-insta-success" : c.status === "rendered" ? "text-insta-success" : "text-insta-warning"
                            )}>
                            {c.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}