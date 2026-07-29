import { Image, X } from "lucide-react";

interface CoverPickerProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function CoverPicker({ value, onChange, disabled = false }: CoverPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="metadata-cover" className="text-sm font-medium">
        Cover image URL
        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Image
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="metadata-cover"
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/cover.jpg"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={disabled}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={disabled}
              aria-label="Remove cover URL"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {value && (
        <img
          src={value}
          alt="Cover preview"
          className="mt-2 size-20 rounded object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );
}
