export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function safeLogScore(value: number, divisor: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp((Math.log10(value + 1) / divisor) * 100);
}

export function normalizeMetric(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return clamp((value / max) * 100);
}
