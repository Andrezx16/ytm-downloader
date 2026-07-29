import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Clock, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  history?: string[];
  onHistorySelect?: (query: string) => void;
  onHistoryRemove?: (query: string) => void;
  onHistoryClear?: () => void;
}

export function SearchBar({
  onSearch,
  isLoading = false,
  history = [],
  onHistorySelect,
  onHistoryRemove,
  onHistoryClear,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hasHistory = history.length > 0 && onHistorySelect;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed.length === 0) return;
      setShowHistory(false);
      onSearch(trimmed);
    },
    [query, onSearch],
  );

  const handleSelect = useCallback(
    (q: string) => {
      setQuery(q);
      setShowHistory(false);
      onHistorySelect?.(q);
    },
    [onHistorySelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowHistory(false);
      }
    },
    [],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div ref={wrapperRef} className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hasHistory && setShowHistory(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search for songs, artists..."
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search query"
          aria-haspopup={hasHistory ? "listbox" : undefined}
          aria-expanded={showHistory}
          disabled={isLoading}
        />

        {showHistory && hasHistory && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Recent</span>
              {onHistoryClear && (
                <button
                  type="button"
                  onClick={onHistoryClear}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div role="listbox">
              {history.map((q) => (
                <div
                  key={q}
                  role="option"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => handleSelect(q)}
                >
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{q}</span>
                  {onHistoryRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHistoryRemove(q);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${q}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading || query.trim().length === 0}
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
