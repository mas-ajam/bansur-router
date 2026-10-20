// Phase 4 (PP-07): background health prober for proxy pools.
// The Proxy Pools screen promises "Health is probed every 60 seconds" —
// this is the mechanism behind that copy. Every interval it tests every
// endpoint of every ACTIVE pool and persists per-endpoint results via
// recordPoolEndpointTests (which never flips isActive). Relay pools
// (vercel/cloudflare/deno/netlify) keep their on-demand relay test and
// are not probed here. Idempotent; safe to start from app bootstrap.

import { getProxyPools, recordPoolEndpointTests } from "@/lib/localDb";
import { testProxyUrl } from "@/lib/network/proxyTest";

const PROBE_INTERVAL_MS = 60_000;
const state = globalThis.__proxyPoolProber || (globalThis.__proxyPoolProber = { started: false, timer: null, running: false });

export async function probeAllProxyPools() {
  if (state.running) return;
  state.running = true;
  try {
    const pools = await getProxyPools({ isActive: true });
    for (const pool of pools) {
      if (pool.type !== "http") continue;
      const endpoints = Array.isArray(pool.endpoints) ? pool.endpoints : [];
      if (endpoints.length === 0) continue;
      const testedAt = new Date().toISOString();
      const results = await Promise.all(
        endpoints.map(async (e) => {
          const r = await testProxyUrl({ proxyUrl: e.url });
          return {
            url: e.url,
            ok: r.ok,
            error: r.error || null,
            latencyMs: typeof r.elapsedMs === "number" ? r.elapsedMs : null,
            testedAt,
          };
        })
      );
      await recordPoolEndpointTests(pool.id, results);
    }
  } catch { /* probing is best-effort; the next round retries */ }
  state.running = false;
}

export function startProxyPoolProber() {
  if (state.started) return;
  state.started = true;
  // First round shortly after boot, then every 60s.
  const kickoff = setTimeout(() => { probeAllProxyPools(); }, 10_000);
  kickoff.unref?.();
  state.timer = setInterval(() => { probeAllProxyPools(); }, PROBE_INTERVAL_MS);
  state.timer.unref?.();
}

export function stopProxyPoolProber() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.started = false;
}
