import type { DownloadOptions } from "./types";

interface DownloadOptionsFormProps {
  value: DownloadOptions;
  onChange: (options: DownloadOptions) => void;
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
  disabled = false,
}: DownloadOptionsFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="output-dir" className="text-xs font-medium text-muted-foreground">
          Output folder
        </label>
        <input
          id="output-dir"
          type="text"
          value={value.output_dir}
          onChange={(e) => onChange({ ...value, output_dir: e.target.value })}
          placeholder="downloads"
          disabled={disabled}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
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
