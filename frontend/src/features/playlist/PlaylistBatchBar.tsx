import { useState, useEffect } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { useSettings } from "@/features/settings";
import { useFolderHistory } from "@/hooks";
import { DownloadOptionsForm } from "@/features/download/DownloadOptions";
import type { DownloadOptions } from "@/features/download/types";

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
  const { settings } = useSettings();
  const { history } = useFolderHistory("playlist");
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState<DownloadOptions>({
    output_dir: history[0] ?? "downloads",
    quality: settings.playlist.quality,
    container: settings.playlist.container,
    embed_thumbnail: settings.playlist.embed_thumbnail,
    embed_metadata: settings.playlist.embed_metadata,
  });

  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      output_dir: history[0] ?? prev.output_dir,
    }));
  }, [history]);

  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      quality: settings.playlist.quality,
      container: settings.playlist.container,
      embed_thumbnail: settings.playlist.embed_thumbnail,
      embed_metadata: settings.playlist.embed_metadata,
    }));
  }, [settings.playlist]);

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
            namespace="playlist"
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}
