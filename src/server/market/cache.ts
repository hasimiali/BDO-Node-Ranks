import type { MarketData } from "../../shared/models.js";

interface CacheEntry {
  data: MarketData;
  expiresAt: number;
}

export class MarketCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number) {}

  getFresh(key: string): MarketData | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  }

  getAny(key: string): MarketData | null {
    return this.entries.get(key)?.data ?? null;
  }

  set(key: string, data: MarketData): void {
    this.entries.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }
}
