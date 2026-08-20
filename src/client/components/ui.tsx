import type React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className = "",
  as = "section",
  "aria-busy": ariaBusy,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "aside";
  "aria-busy"?: boolean;
}) {
  const Element = as;
  return (
    <Element
      className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}
      aria-busy={ariaBusy}
    >
      {children}
    </Element>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl border bg-card p-5 shadow-sm ${
        featured
          ? "ring-1 ring-foreground/10"
          : ""
      }`}
    >
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold tracking-tight" title={value}>{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "teal" | "positive" | "warning" | "negative";
  className?: string;
}) {
  const tones = {
    neutral: "border-border bg-secondary text-secondary-foreground",
    gold: "border-border bg-primary text-primary-foreground",
    teal: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    positive: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    negative: "border-destructive/20 bg-destructive/10 text-destructive",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const fieldClass = "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function FeedbackState({
  title,
  message,
  action,
  actionLabel,
  tone = "neutral",
  compact = false,
}: {
  title: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  tone?: "neutral" | "error" | "success";
  compact?: boolean;
}) {
  const toneClass = tone === "error" ? "border-destructive/30 bg-destructive/10" : tone === "success" ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-muted/40";
  return (
    <div className={`rounded-lg border ${toneClass} ${compact ? "p-4" : "p-8 text-center"}`} role={tone === "error" ? "alert" : "status"}>
      <div className="font-semibold">{title}</div>
      <p className={`text-sm text-muted-foreground ${compact ? "mt-1" : "mx-auto mt-2 max-w-xl"}`}>{message}</p>
      {action && actionLabel && <button className="btn mt-4" type="button" onClick={action}>{actionLabel}</button>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden="true" />;
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-6 w-3/4" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} aria-label={label} className="inline-flex cursor-help">{children}</span>
       <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-56 -translate-x-1/2 rounded-sm border border-[#2f2d24] bg-[#302f27] p-2 text-left text-xs font-normal normal-case tracking-normal text-[#f4ead2] shadow-xl group-hover:block group-focus-within:block">{label}</span>
    </span>
  );
}

export function HelpLabel({ label, help }: { label: string; help: string }) {
  return <span className="inline-flex items-center gap-1.5">{label}<Tooltip label={help}><span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full border border-[var(--border-strong)] text-[10px] text-[var(--text-muted)]">?</span></Tooltip></span>;
}
