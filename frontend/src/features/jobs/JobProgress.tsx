interface JobProgressProps {
  progress: number;
  showLabel?: boolean;
}

export function JobProgress({ progress, showLabel = true }: JobProgressProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
