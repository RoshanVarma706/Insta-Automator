/* Home Page — Video URL Input */
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Progress } from "@/components/ui";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const [form, setForm] = useState({ url: "", source: "youtube" as "youtube" | "instagram" | "generic" });
  const [status, setStatus] = useState<{ stage: "idle" | "processing"; progress: number; message: string }>({
    stage: "idle", progress: 0, message: "Ready",
  });
  const { toast } = useToast();
  const pathname = usePathname();

  const handleSubmit = async () => {
    setStatus({ stage: "processing", progress: 0, message: "Starting pipeline..." });
    try {
      const r = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url, source: form.source }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Unknown error");

      if (d.status === "completed") {
        setStatus({ stage: "completed", progress: 100, message: "✅ Published to Instagram!" });
        toast({ title: "Success", description: d.result?.caption || "Clip published!", variant: "success" });
      } else if (d.status === "processing") {
        const poll = setInterval(async () => {
          const pr = await fetch(`/api/webhook?source=${form.source}`, { method: "GET" });
          const pd = await pr.json();
          if (pd.status === "completed") {
            clearInterval(poll);
            setStatus({ stage: "completed", progress: 100, message: "✅ Published!" });
            toast({ title: "Success", description: pd.result?.caption || "Clip published!", variant: "success" });
          } else if (pd.status === "failed") {
            clearInterval(poll);
            setStatus({ stage: "failed", progress: 0, message: `❌ ${pd.error || "Failed"}` });
            toast({ title: "Error", description: pd.error || "Unknown error", variant: "destructive" });
          } else if (pd.steps) {
            setStatus({
              stage: "processing",
              progress: Math.round((pd.steps.length / 5) * 100),
              message: pd.steps.at(-1) || "Processing...",
            });
          }
        }, 3000);
        return () => clearInterval(poll);
      }
    } catch (e: any) {
      setStatus({ stage: "failed", progress: 0, message: "Error" });
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (status.stage === "completed") {
      const t = setTimeout(() => {
        setStatus({ stage: "idle", progress: 0, message: "Ready" });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [status.stage]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="insta-ambient animate-inca-drift fixed inset-0 z-0 pointer-events-none" />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8">
          <CardHeader>
            <CardTitle>Insta Automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Input
              placeholder="Enter video URL (YouTube/Instagram/Generic)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              disabled={status.stage === "processing"}
              className="input-field w-full"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setForm({ ...form, source: "youtube" })}
                className={cn("pr-2", status.stage === "processing" && "opacity-50 cursor-not-allowed")}
              >
                YouTube
              </Button>
              <Button
                onClick={() => setForm({ ...form, source: "instagram" })}
                className={cn("pr-2", status.stage === "processing" && "opacity-50 cursor-not-allowed")}
              >
                Instagram
              </Button>
              <Button
                onClick={() => setForm({ ...form, source: "generic" })}
                className={cn(status.stage === "processing" && "opacity-50 cursor-not-allowed")}
              >
                Generic
              </Button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!form.url || status.stage === "processing"}
              className="w-full btn-insta-primary"
            >
              {status.stage === "processing" ? (
                <span className="spinner mr-2" /> Processing...
              ) : "Generate Instagram Reel"}
            </Button>

            {status.stage !== "idle" && (
              <Card className="p-4">
                <p className="text-insta-muted text-sm">{status.message}</p>
                <Progress value={status.progress} className="my-2" />
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}