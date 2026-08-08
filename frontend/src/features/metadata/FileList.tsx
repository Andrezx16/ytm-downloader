import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Music, ArrowLeft, CheckSquare, Square, Play, ArrowUp, ArrowDown, ListMusic, X } from "lucide-react";
import type { ScanFile } from "@/api/pipeline";
import type { ApiError } from "@/api/errors";

type SortBy = "name" | "added" | "modified" | "size" | "m3u";
type SortDir = "asc" | "desc";

interface FileListProps {
  files: ScanFile[];
  folderPath: string;
  selectedIndices: Set<number>;
  onSelectFile: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onStartQueue: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: ApiError | null;
  m3uOrder?: string[] | null;
  m3uName?: string | null;
  onSelectM3u?: () => void;
  onClearM3u?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(mtime: number): string {
  const d = new Date(mtime * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "added", label: "Date added" },
  { value: "modified", label: "Date modified" },
  { value: "size", label: "Size" },
];

export function FileList({
  files,
  folderPath,
  selectedIndices,
  onSelectFile,
  onSelectAll,
  onDeselectAll,
  onStartQueue,
  onBack,
  isLoading,
  error,
  m3uOrder,
  m3uName,
  onSelectM3u,
  onClearM3u,
}: FileListProps) {
  const [sortBy, setSortBy] = useState<SortBy>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const draggingRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const dragSelectModeRef = useRef(true);
  const didDragRef = useRef(false);
  const selectedRef = useRef(selectedIndices);
  const listRef = useRef<HTMLDivElement>(null);
  selectedRef.current = selectedIndices;

  const sortedFiles = useMemo(() => {
    const indexed = files.map((file, i) => ({ file, originalIndex: i }));
    if (sortBy === "m3u" && m3uOrder) {
      const orderMap = new Map(m3uOrder.map((name, i) => [name.toLowerCase(), i]));
      indexed.sort((a, b) => {
        const aIdx = orderMap.get(a.file.name.toLowerCase());
        const bIdx = orderMap.get(b.file.name.toLowerCase());
        const aRank = aIdx !== undefined ? aIdx : Infinity;
        const bRank = bIdx !== undefined ? bIdx : Infinity;
        return aRank - bRank;
      });
    } else {
      indexed.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.file.name.localeCompare(b.file.name);
        else if (sortBy === "added") cmp = a.file.ctime - b.file.ctime;
        else if (sortBy === "modified") cmp = a.file.mtime - b.file.mtime;
        else cmp = a.file.size - b.file.size;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return indexed;
  }, [files, sortBy, sortDir, m3uOrder]);

  const handleDragStart = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = index;
    didDragRef.current = false;
    dragSelectModeRef.current = !selectedRef.current.has(index);
    onSelectFile(index);
  }, [onSelectFile]);

  const handleDragEnter = useCallback((index: number) => {
    if (!draggingRef.current) return;
    const isCurrentlySelected = selectedRef.current.has(index);
    const wantsSelect = dragSelectModeRef.current;
    if (wantsSelect && !isCurrentlySelected) {
      onSelectFile(index);
      didDragRef.current = true;
    } else if (!wantsSelect && isCurrentlySelected) {
      onSelectFile(index);
      didDragRef.current = true;
    }
  }, [onSelectFile]);

  useEffect(() => {
    const handleMouseUp = () => {
      draggingRef.current = false;
      dragStartRef.current = null;
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const toggleSort = (by: SortBy) => {
    if (sortBy === by) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(by); setSortDir("asc"); }
  };

  const SortIcon = ({ by }: { by: SortBy }) => {
    if (sortBy !== by) return null;
    return sortDir === "asc"
      ? <ArrowUp className="size-3" />
      : <ArrowDown className="size-3" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Scanning folder...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-destructive">
        <p className="text-sm font-medium">Scan failed</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
        <button
          onClick={onBack}
          className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Go back
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Music className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No audio files found in this folder</p>
        <button
          onClick={onBack}
          className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Go back
        </button>
      </div>
    );
  }

  const allSelected = selectedIndices.size === files.length;
  const someSelected = selectedIndices.size > 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <p className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? "s" : ""} in {folderPath}
        </p>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleSort(opt.value)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
              sortBy === opt.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
            <SortIcon by={opt.value} />
          </button>
        ))}
        {m3uOrder && (
          <button
            type="button"
            onClick={() => toggleSort("m3u")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
              sortBy === "m3u"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListMusic className="size-3" />
            M3U
            <SortIcon by="m3u" />
          </button>
        )}
      </div>

      {/* M3U info bar */}
      {m3uOrder && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground truncate">
            M3U: {m3uName} ({m3uOrder.length} entries)
          </span>
          {onClearM3u && (
            <button
              type="button"
              onClick={onClearM3u}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
      {!m3uOrder && onSelectM3u && (
        <button
          type="button"
          onClick={onSelectM3u}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ListMusic className="size-3" />
          Load M3U
        </button>
      )}

      {/* Select all / Deselect all */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {allSelected ? (
              <CheckSquare className="size-4" aria-hidden="true" />
            ) : (
              <Square className="size-4" aria-hidden="true" />
            )}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          {someSelected && !allSelected && (
            <button
              onClick={onDeselectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Deselect all
            </button>
          )}
        </div>
        {someSelected && (
          <p className="text-xs text-muted-foreground">
            {selectedIndices.size} selected
          </p>
        )}
      </div>

      {/* File list — scrollable, drag-to-select */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 select-none">
        {sortedFiles.map(({ file, originalIndex }) => {
          const isSelected = selectedIndices.has(originalIndex);
          return (
            <button
              key={file.path}
              onMouseDown={(e) => handleDragStart(originalIndex, e)}
              onMouseEnter={() => handleDragEnter(originalIndex)}
              className={`flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent/50"
              }`}
            >
              {isSelected ? (
                <CheckSquare className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Square className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(file.mtime)}</span>
            </button>
          );
        })}
      </div>

      {/* Start processing button — always visible */}
      <button
        onClick={onStartQueue}
        disabled={!someSelected}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 shrink-0"
      >
        <Play className="size-4" />
        {someSelected
          ? `Process ${selectedIndices.size} file${selectedIndices.size !== 1 ? "s" : ""}`
          : "Select files to process"}
      </button>
    </div>
  );
}
