import { useState, useMemo } from "react";
import { Music, ArrowLeft, CheckSquare, Square, Play, ArrowUp, ArrowDown } from "lucide-react";
import type { ScanFile } from "@/api/pipeline";
import type { ApiError } from "@/api/errors";

type SortBy = "name" | "added" | "modified" | "size";
type SortDir = "asc" | "desc";

interface FileListProps {
  files: ScanFile[];
  folderPath: string;
  selectedIndices: Set<number>;
  onSelectFile: (index: number) => void;
  onSelectAll: () => void;
  onStartQueue: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: ApiError | null;
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
  onStartQueue,
  onBack,
  isLoading,
  error,
}: FileListProps) {
  const [sortBy, setSortBy] = useState<SortBy>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedFiles = useMemo(() => {
    const indexed = files.map((file, i) => ({ file, originalIndex: i }));
    indexed.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.file.name.localeCompare(b.file.name);
      else if (sortBy === "added") cmp = a.file.ctime - b.file.ctime;
      else if (sortBy === "modified") cmp = a.file.mtime - b.file.mtime;
      else cmp = a.file.size - b.file.size;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return indexed;
  }, [files, sortBy, sortDir]);

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
      </div>

      {/* Select all / selection info */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {allSelected ? (
            <CheckSquare className="size-4" aria-hidden="true" />
          ) : (
            <Square className="size-4" aria-hidden="true" />
          )}
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        {someSelected && (
          <p className="text-xs text-muted-foreground">
            {selectedIndices.size} selected
          </p>
        )}
      </div>

      {/* File list — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {sortedFiles.map(({ file, originalIndex }) => {
          const isSelected = selectedIndices.has(originalIndex);
          return (
            <button
              key={file.path}
              onClick={() => onSelectFile(originalIndex)}
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
