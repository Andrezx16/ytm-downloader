import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  FolderOpen,
  X,
  Clock,
} from "lucide-react";
import { FolderBrowser } from "@/components/FolderBrowser";

interface FolderPickerProps {
  onScan: (path: string) => void;
  isLoading?: boolean;
  history: string[];
  onHistorySelect: (path: string) => void;
  onHistoryRemove: (path: string) => void;
  onHistoryClear: () => void;
}

export function FolderPicker({
  onScan,
  isLoading = false,
  history,
  onHistorySelect,
  onHistoryRemove,
  onHistoryClear,
}: FolderPickerProps) {
  const [path, setPath] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
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
    const trimmed = path.trim();
    if (trimmed) onScan(trimmed);
  };

  const handleBrowserSelect = (selectedPath: string) => {
    setPath(selectedPath);
    setShowBrowser(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <label htmlFor="folder-path" className="text-sm font-medium">
          Folder path
        </label>
        <div className="flex gap-2">
          <div ref={wrapperRef} className="relative flex-1">
            <FolderOpen
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="folder-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onFocus={() => history.length > 0 && setShowHistory(true)}
              placeholder="C:\Music\my album"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            {showHistory && history.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-background shadow-md">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
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
                    <Clock className="size-3 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => { onHistorySelect(h); setShowHistory(false); }}
                      className="flex-1 truncate text-left text-xs text-foreground"
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
            type="button"
            onClick={() => setShowBrowser(!showBrowser)}
            disabled={isLoading}
            className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50"
            title="Browse folders"
          >
            <FolderOpen className="size-4" />
          </button>
          <button
            type="submit"
            disabled={isLoading || path.trim().length === 0}
            className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? "Scanning..." : "Scan"}
            {!isLoading && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Scans for audio files (MP3, M4A, FLAC, OGG, WAV, AAC)
        </p>
      </form>

      {showBrowser && (
        <FolderBrowser onSelect={handleBrowserSelect} onClose={() => setShowBrowser(false)} />
      )}
    </div>
  );
}
