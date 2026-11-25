/* Settings Page — Configuration */
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const pathname = usePathname();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    autoPublish: false,
    minConfidence: 85,
    minApprovalRate: 90,
    spacingMinutes: 15,
    dailyCap: 10,
  });

  const handleSave = () => {
    toast({ title: "Saved", description: "Settings updated", variant: "success" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="insta-ambient animate-inca-drift fixed inset-0 z-0 pointer-events-none" />
      <div className="max-w--xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Min confidence %"
              type="number"
              min={0}
              max={100}
              value={settings.minConfidence}
              onChange={(e) => setSettings({ ...settings, minConfidence: Number(e.target.value) })}
              className="input-field"
            />
            <Input
              placeholder="Min approval rate %"
              type="number"
              min={0}
              max={100}
              value={settings.minApprovalRate}
              onChange={(e) => setSettings({ ...settings, minApprovalRate: Number(e.target.value) })}
              className="input-field"
            />
            <Input
              placeholder="Spacing between posts (min)"
              type="number"
              min={5}
              max={120}
              value={settings.spacingMinutes}
              onChange={(e) => setSettings({ ...settings, spacingMinutes: Number(e.target.value) })}
              className="input-field"
            />
            <Input
              placeholder="Daily upload cap"
              type="number"
              min={1}
              max={50}
              value={settings.dailyCap}
              onChange={(e) => setSettings({ ...settings, dailyCap: Number(e.target.value) })}
              className="input-field"
            />
            <Button onClick={handleSave} className="w-full btn-insta-primary">
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}