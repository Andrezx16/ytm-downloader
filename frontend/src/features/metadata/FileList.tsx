import { Music, ArrowLeft, CheckSquare, Square, Play } from "lucide-react";
import type { ScanFile } from "@/api/pipeline";
import type { ApiError } from "@/api/errors";

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
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

      {/* Select all / selection info */}
      <div className="flex items-center justify-between">
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

      {/* File list */}
      <div className="flex flex-col gap-1">
        {files.map((file, index) => {
          const isSelected = selectedIndices.has(index);
          return (
            <button
              key={file.path}
              onClick={() => onSelectFile(index)}
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
            </button>
          );
        })}
      </div>

      {/* Start processing button */}
      <button
        onClick={onStartQueue}
        disabled={!someSelected}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        <Play className="size-4" />
        {someSelected
          ? `Process ${selectedIndices.size} file${selectedIndices.size !== 1 ? "s" : ""}`
          : "Select files to process"}
      </button>
    </div>
  );
}
