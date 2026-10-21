import { NextResponse } from "next/server";
import { getPxpipeStats } from "@/lib/pxpipe/events.js";
import { getPxpipeCacheStats } from "@/lib/pxpipe/loader.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const recentLimit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const stats = getPxpipeStats({ recentLimit });
    // Cache aggregates: the loader's own counters are the ground truth.
    // The events-based estimate counts every recorded event as a lookup,
    // which is wrong whenever the cache was bypassed (TTL/cap 0, oversized
    // payload) — prefer the real counters whenever they exist.
    try {
      const cache = getPxpipeCacheStats();
      const lookups = (cache.hits || 0) + (cache.misses || 0);
      if (lookups > 0) {
        stats.cacheHits = cache.hits;
        stats.cacheLookups = lookups;
        stats.cacheHitRate = +(cache.hits / lookups).toFixed(4);
      }
    } catch { /* keep the events-based estimate */ }
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
