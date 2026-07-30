import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { trackJob } from "@/features/jobs";
import { useDownload } from "./hooks";
import { useSettings } from "@/features/settings";
import { useFolderHistory } from "@/hooks";
import { DownloadOptionsForm } from "./DownloadOptions";
import type { DownloadOptions } from "./types";

interface DownloadDialogProps {
  url: string;
  title: string;
  open: boolean;
  onClose: () => void;
  defaultOptions?: Partial<DownloadOptions>;
}

export function DownloadDialog({
  url,
  title,
  open,
  onClose,
  defaultOptions,
}: DownloadDialogProps) {
  const { settings } = useSettings();
  const { history, add } = useFolderHistory("downloads");
  const [options, setOptions] = useState<DownloadOptions>({
    output_dir: history[0] ?? "downloads",
    ...settings.downloads,
    ...defaultOptions,
  });

  const { download, isLoading, error, reset } = useDownload();

  useEffect(() => {
    if (open) {
      setOptions({
        output_dir: history[0] ?? "downloads",
        ...settings.downloads,
        ...defaultOptions,
      });
    } else {
      reset();
    }
  }, [open, history, settings.downloads, defaultOptions, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!options.output_dir.trim()) return;
      add(options.output_dir);
      download(
        { url, ...options },
        {
          onSuccess: (data) => {
            trackJob(data.id, title);
            onClose();
          },
        },
      );
    },
    [url, title, options, download, add, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold truncate pr-8">{title}</h2>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DownloadOptionsForm
            value={options}
            onChange={setOptions}
            namespace="downloads"
            disabled={isLoading}
          />

          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !options.output_dir.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? "Starting..." : "Download"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
