import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { useFolderHistory } from "@/hooks";
import { FolderBrowser } from "@/components/FolderBrowser";
import type { DownloadOptions } from "./types";

interface DownloadOptionsFormProps {
  value: DownloadOptions;
  onChange: (options: DownloadOptions) => void;
  namespace?: string;
  disabled?: boolean;
}

const QUALITY_OPTIONS: { value: DownloadOptions["quality"]; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CONTAINER_OPTIONS: { value: DownloadOptions["container"]; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "m4a", label: "M4A" },
  { value: "opus", label: "Opus" },
  { value: "original", label: "Original" },
];

export function DownloadOptionsForm({
  value,
  onChange,
  namespace = "downloads",
  disabled = false,
}: DownloadOptionsFormProps) {
  const { history, add } = useFolderHistory(namespace);
  const [showHistory, setShowHistory] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHistory) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHistory]);

  const handleFolderSelect = useCallback(
    (path: string) => {
      onChange({ ...value, output_dir: path });
      add(path);
      setShowBrowser(false);
    },
    [value, onChange, add],
  );

  const handleHistorySelect = useCallback(
    (path: string) => {
      onChange({ ...value, output_dir: path });
      setShowHistory(false);
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="output-dir" className="text-xs font-medium text-muted-foreground">
          Output folder
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1" ref={dropdownRef}>
            <input
              id="output-dir"
              type="text"
              value={value.output_dir}
              onChange={(e) => onChange({ ...value, output_dir: e.target.value })}
              placeholder="downloads"
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                disabled={disabled}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Recent folders"
              >
                <ChevronDown className="size-3.5" />
              </button>
            )}
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-md">
                {history.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleHistorySelect(path)}
                    className="flex w-full items-center truncate px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {path}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowBrowser(!showBrowser)}
            disabled={disabled}
            className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
            title="Browse folders"
          >
            <FolderOpen className="size-4" />
          </button>
        </div>
        {showBrowser && (
          <FolderBrowser
            onSelect={handleFolderSelect}
            onClose={() => setShowBrowser(false)}
            initialPath={value.output_dir}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quality" className="text-xs font-medium text-muted-foreground">
          Quality
        </label>
        <select
          id="quality"
          value={value.quality}
          onChange={(e) => onChange({ ...value, quality: e.target.value as DownloadOptions["quality"] })}
          disabled={disabled}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="container" className="text-xs font-medium text-muted-foreground">
          Format
        </label>
        <select
          id="container"
          value={value.container}
          onChange={(e) => onChange({ ...value, container: e.target.value as DownloadOptions["container"] })}
          disabled={disabled}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {CONTAINER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.embed_thumbnail}
            onChange={(e) => onChange({ ...value, embed_thumbnail: e.target.checked })}
            disabled={disabled}
            className="size-4 rounded border-input"
          />
          Embed thumbnail
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.embed_metadata}
            onChange={(e) => onChange({ ...value, embed_metadata: e.target.checked })}
            disabled={disabled}
            className="size-4 rounded border-input"
          />
          Embed metadata
        </label>
      </div>
    </div>
  );
}
