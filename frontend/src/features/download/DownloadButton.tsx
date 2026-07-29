import { Download } from "lucide-react";

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function DownloadButton({
  onClick,
  disabled = false,
  label = "Download",
}: DownloadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
