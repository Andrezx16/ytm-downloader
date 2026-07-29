import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  ArrowUp,
  FolderOpen,
  Folder,
  ChevronRight,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { getFolders } from "@/api/pipeline";
import type { FolderItem } from "@/api/pipeline";

interface FolderPickerProps {
  onScan: (path: string) => void;
  isLoading?: boolean;
  history: string[];
  onHistorySelect: (path: string) => void;
  onHistoryRemove: (path: string) => void;
  onHistoryClear: () => void;
}

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  if (!path) return null;
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(sep).filter(Boolean);
  const segments: { label: string; path: string }[] = [];

  if (path.startsWith(sep)) {
    segments.push({ label: sep, path: sep });
  }

  let accumulated = path.startsWith(sep) ? sep : "";
  for (const part of parts) {
    accumulated += part + sep;
    segments.push({
      label: part,
      path: accumulated.endsWith(sep) ? accumulated.slice(0, -1) || sep : accumulated,
    });
  }

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto text-xs text-muted-foreground">
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex shrink-0 items-center gap-0.5">
          {i > 0 && <ChevronRight className="size-3 shrink-0" />}
          <button
            type="button"
            onClick={() => onNavigate(seg.path)}
            className="truncate rounded px-1 py-0.5 hover:bg-accent hover:text-foreground"
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function FolderBrowser({
  onSelect,
  onClose,
}: {
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFolders(path);
      setCurrentPath(data.path);
      setFolders(data.folders);
      setParent(data.parent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPath("");
  }, [loadPath]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Browse folders</p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <Breadcrumb path={currentPath} onNavigate={loadPath} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive py-4 text-center">{error}</p>
      )}

      {!loading && !error && (
        <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
          {parent && (
            <button
              type="button"
              onClick={() => loadPath(parent)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
            >
              <ArrowUp className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">..</span>
            </button>
          )}
          {folders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              onClick={() => loadPath(folder.path)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
          {folders.length === 0 && !parent && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No folders found
            </p>
          )}
        </div>
      )}

      {currentPath && (
        <button
          type="button"
          onClick={() => onSelect(currentPath)}
          className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FolderOpen className="size-4" />
          Select this folder
        </button>
      )}
    </div>
  );
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
