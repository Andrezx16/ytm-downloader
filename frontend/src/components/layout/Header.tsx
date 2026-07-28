import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

export function Header() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex-1" />
      <button
        onClick={cycleTheme}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle theme"
      >
        <ThemeIcon className="size-4" />
      </button>
    </header>
  );
}
