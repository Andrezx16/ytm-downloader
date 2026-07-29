import { useLocation } from "react-router-dom";
import { Moon, Sun, Monitor, Menu } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { NAV_ITEMS } from "./Navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  ...Object.fromEntries(NAV_ITEMS.map((item) => [item.route, item.label])),
};

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] ?? "Home";

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-semibold">{pageTitle}</h1>
      </div>
      <button
        onClick={cycleTheme}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle theme"
      >
        <ThemeIcon className="size-4" aria-hidden="true" />
      </button>
    </header>
  );
}
