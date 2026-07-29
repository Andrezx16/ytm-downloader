import { useState } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import type { DownloadOptions } from "@/features/download/types";
import { DownloadOptionsForm } from "@/features/download/DownloadOptions";

const DEFAULT_OPTIONS: DownloadOptions = {
  output_dir: "downloads",
  quality: "best",
  container: "auto",
  embed_thumbnail: true,
  embed_metadata: true,
};

interface PlaylistBatchBarProps {
  selectedCount: number;
  onDownload: (options: DownloadOptions) => void;
  isLoading: boolean;
}

export function PlaylistBatchBar({
  selectedCount,
  onDownload,
  isLoading,
}: PlaylistBatchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState<DownloadOptions>(DEFAULT_OPTIONS);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {selectedCount} track{selectedCount !== 1 ? "s" : ""} selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Options
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => onDownload(options)}
            disabled={selectedCount === 0 || isLoading}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {isLoading ? "Starting..." : "Download"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <DownloadOptionsForm
            value={options}
            onChange={setOptions}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}
