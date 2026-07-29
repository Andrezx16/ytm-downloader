import { NavLink } from "react-router-dom";
import { Search, Download, ListMusic, Tag, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  route: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Search", icon: Search, route: "/search" },
  { label: "Downloads", icon: Download, route: "/downloads" },
  { label: "Playlist", icon: ListMusic, route: "/playlist" },
  { label: "Metadata", icon: Tag, route: "/metadata" },
  { label: "Settings", icon: Settings, route: "/settings" },
];

interface NavItemLinkProps {
  item: NavItem;
  collapsed: boolean;
}

function NavItemLink({ item, collapsed }: NavItemLinkProps) {
  return (
    <NavLink
      to={item.route}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        } ${collapsed ? "justify-center" : ""}`
      }
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

interface NavigationProps {
  collapsed?: boolean;
}

export function Navigation({ collapsed = false }: NavigationProps) {
  return (
    <nav className="flex flex-col gap-1" role="navigation" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavItemLink key={item.route} item={item} collapsed={collapsed} />
      ))}
    </nav>
  );
}
