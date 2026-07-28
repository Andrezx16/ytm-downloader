import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Settings className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">Configure providers and application preferences.</p>
    </div>
  );
}
