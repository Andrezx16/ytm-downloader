import { Download } from "lucide-react";

export function DownloadsPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Download className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Downloads</h1>
      <p className="text-muted-foreground">View active and completed downloads.</p>
    </div>
  );
}
