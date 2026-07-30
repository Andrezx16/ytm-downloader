import { useState, useEffect, useCallback } from "react";
import {
  ArrowUp,
  FolderOpen,
  Folder,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { getFolders } from "@/api/pipeline";
import type { FolderItem } from "@/api/pipeline";

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

export interface FolderBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  initialPath?: string;
}

export function FolderBrowser({
  onSelect,
  onClose,
  initialPath,
}: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath ?? "");
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
    loadPath(initialPath ?? "");
  }, [loadPath, initialPath]);

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
