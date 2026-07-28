import { Home } from "lucide-react";

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Home className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">YTM Downloader</h1>
      <p className="text-muted-foreground">Download music from YouTube and YouTube Music.</p>
    </div>
  );
}
