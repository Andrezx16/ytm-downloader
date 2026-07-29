import { useState, useRef, useEffect } from "react";
import { ListMusic, X, Clock } from "lucide-react";

interface PlaylistUrlFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  history: string[];
  onHistorySelect: (url: string) => void;
  onHistoryRemove: (url: string) => void;
  onHistoryClear: () => void;
}

export function PlaylistUrlForm({
  onSubmit,
  isLoading,
  history,
  onHistorySelect,
  onHistoryRemove,
  onHistoryClear,
}: PlaylistUrlFormProps) {
  const [url, setUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 py-20">
      <ListMusic className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Playlist</h1>
      <p className="text-muted-foreground">Paste a YouTube playlist URL to browse and download.</p>
      <div ref={wrapperRef} className="relative flex w-full max-w-md gap-2">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            placeholder="https://youtube.com/playlist?list=..."
            disabled={isLoading}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          {showHistory && history.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-background shadow-md">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <span className="text-xs text-muted-foreground">Recent</span>
                <button
                  type="button"
                  onClick={() => { onHistoryClear(); setShowHistory(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              {history.map((h) => (
                <div key={h} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50">
                  <Clock className="size-3 text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    onClick={() => { onHistorySelect(h); setShowHistory(false); }}
                    className="flex-1 text-left text-xs truncate text-foreground"
                  >
                    {h}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onHistoryRemove(h); }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Load"}
        </button>
      </div>
    </form>
  );
}
