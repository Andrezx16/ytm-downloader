import { useState } from "react";
import { ChevronDown, ChevronUp, Image, X } from "lucide-react";
import { useImageDimensions } from "./useImageDimensions";
import type { MatchCandidate } from "@/api/pipeline";

interface CoverPickerProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  alternatives?: MatchCandidate[];
  onAlternativeSelect?: (url: string) => void;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    deezer: "Deezer",
    apple: "Apple Music",
    musicbrainz: "MusicBrainz",
    lastfm: "Last.fm",
    spotify: "Spotify",
    ytmusic: "YouTube Music",
  };
  return labels[source] ?? source;
}

function CoverAlternative({
  match,
  isActive,
  onSelect,
  disabled,
}: {
  match: MatchCandidate;
  isActive: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const dims = useImageDimensions(match.cover_url);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || isActive}
      className={`relative shrink-0 rounded-md border transition-colors ${
        isActive
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/50"
      } disabled:pointer-events-none`}
    >
      {match.cover_url ? (
        <img
          src={match.cover_url}
          alt=""
          className="size-16 rounded-md object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-md bg-muted">
          <Image className="size-5 text-muted-foreground" />
        </div>
      )}
      <span className="absolute bottom-0.5 left-0.5 rounded bg-foreground/80 px-1 py-px text-[8px] leading-none text-background">
        {sourceLabel(match.source)}
      </span>
      {dims && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-foreground/80 px-1 py-px text-[8px] leading-none text-background">
          {dims.w}x{dims.h}
        </span>
      )}
    </button>
  );
}

export function CoverPicker({
  value,
  onChange,
  disabled = false,
  alternatives = [],
  onAlternativeSelect,
}: CoverPickerProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const hasAlternatives = alternatives.length > 0;

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
      {hasAlternatives && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            {showAlternatives ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            {alternatives.length} other cover{alternatives.length !== 1 ? "s" : ""} available
          </button>
          {showAlternatives && (
            <div className="mt-2 flex flex-wrap gap-2">
              {alternatives.map((match, i) => (
                <CoverAlternative
                  key={`${match.source}-${i}`}
                  match={match}
                  isActive={match.cover_url === value}
                  onSelect={() => {
                    if (match.cover_url && onAlternativeSelect) {
                      onAlternativeSelect(match.cover_url);
                    }
                  }}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
