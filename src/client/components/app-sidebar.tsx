import { useEffect, useState } from "react";
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Database,
  Map,
  Menu,
  Network,
  Server,
} from "lucide-react";
import type { MarketStatus } from "../../shared/models";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type AppPage =
  "dashboard" | "nodes" | "map" | "crafting" | "data" | "detail";
type Resource<T> =
  | { state: "loading"; data: T | null; error: null }
  | { state: "success"; data: T; error: null }
  | { state: "error"; data: T | null; error: string };

interface SidebarProps {
  page: AppPage;
  navigate: (page: Exclude<AppPage, "detail">) => void;
  marketRegion: string;
  setMarketRegion: (region: string) => void;
  regions: readonly string[];
  status: Resource<MarketStatus>;
  updating: boolean;
  openSupport: () => void;
}

const primaryItems = [
  { id: "dashboard" as const, label: "Overview", icon: BarChart3 },
  { id: "nodes" as const, label: "Rankings", icon: Network },
  { id: "map" as const, label: "Node map", icon: Map },
  { id: "crafting" as const, label: "Craft profit", icon: Calculator },
];

export function AppSidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("bdo-sidebar-collapsed") === "true",
  );
  useEffect(() => {
    localStorage.setItem("bdo-sidebar-collapsed", String(collapsed));
  }, [collapsed]);
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <SidebarContent {...props} collapsed={collapsed} />
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-4 top-20 z-10 size-8 rounded-full bg-background"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </aside>
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 min-w-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="p-0">
            <SheetTitle className="sr-only">Application navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate BDO Profit Lab
            </SheetDescription>
            <SidebarContent {...props} mobile />
          </SheetContent>
        </Sheet>
        <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          P
        </div>
        <span className="min-w-0 truncate text-sm font-semibold">
          BDO Profit Lab
        </span>
      </div>
      <div
        className={cn(
          "hidden shrink-0 lg:block transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-64",
        )}
      />
    </>
  );
}

function SidebarContent({
  page,
  navigate,
  marketRegion,
  setMarketRegion,
  regions,
  status,
  updating,
  openSupport,
  collapsed = false,
  mobile = false,
}: SidebarProps & { collapsed?: boolean; mobile?: boolean }) {
  const active = page === "detail" ? "nodes" : page;
  const navButton = (
    item:
      | (typeof primaryItems)[number]
      | { id: "data"; label: string; icon: typeof Database },
  ) => {
    const Icon = item.icon;
    const button = (
      <button
        type="button"
        aria-current={active === item.id ? "page" : undefined}
        onClick={() => navigate(item.id)}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
          active === item.id &&
            "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </button>
    );
    return mobile ? (
      <SheetClose asChild key={item.id}>
        {button}
      </SheetClose>
    ) : (
      <div key={item.id}>{button}</div>
    );
  };
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div
        className={cn(
          "flex h-12 items-center gap-3 px-2",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          P
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Profit Lab</div>
            <div className="text-xs text-muted-foreground">
              Market & life skill analytics
            </div>
          </div>
        )}
      </div>
      <Separator className="my-3" />
      <nav className="grid gap-1" aria-label="Primary">
        {primaryItems.map(navButton)}
      </nav>
      <div className="mt-6">
        <div
          className={cn(
            "mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          Admin
        </div>
        {navButton({ id: "data", label: "Community data", icon: Database })}
      </div>
      <div className="mt-auto grid gap-2">
        <Separator className="mb-1" />
        {!collapsed && (
          <label className="grid gap-1.5 px-1 text-xs font-medium text-muted-foreground">
            <span>Market region</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm"
              value={marketRegion}
              onChange={(event) => setMarketRegion(event.target.value)}
            >
              {regions.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>
        )}
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? providerText(status, updating) : undefined}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              status.data?.available
                ? "bg-emerald-500"
                : status.state === "error"
                  ? "bg-destructive"
                  : "bg-amber-500",
            )}
          />
          {!collapsed && (
            <span className="truncate">{providerText(status, updating)}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn("w-full", !collapsed && "justify-start")}
          onClick={openSupport}
        >
          <Coffee />
          {!collapsed && "Support"}
        </Button>
        <ThemeToggle collapsed={collapsed} />
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 pt-1 text-[11px] text-muted-foreground">
            <Server className="size-3" />
            Unofficial market data
          </div>
        )}
      </div>
    </div>
  );
}

function providerText(status: Resource<MarketStatus>, updating: boolean) {
  if (updating) return "Updating market data";
  if (status.state === "error") return "Provider unavailable";
  if (status.data) return `${status.data.provider} · ${status.data.region}`;
  return "Checking provider";
}
