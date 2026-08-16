export function formatSilver(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function confidenceClass(confidence: string): string {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (confidence === "estimated") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-red-500/15 text-red-300 border-red-500/30";
}
