import { Menu, Music2, X } from "lucide-react";
import { Navigation } from "./Navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-50 flex h-full flex-col border-r border-border bg-card transition-all duration-200 lg:relative lg:z-auto ${
          collapsed ? "w-16" : "w-56"
        } ${collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"}`}
        aria-label="Sidebar"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <Music2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-base font-semibold truncate">YTM Downloader</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <Menu className="size-4" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <Navigation collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

