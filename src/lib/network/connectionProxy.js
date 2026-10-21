import { getProxyPoolById } from "@/models";

// Safely normalize any value into a trimmed string.
function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// ─── Proxy pool rotation state (in-memory) ─────────────────────────
const rotateState = new Map(); // providerId → { index }
const endpointRotateState = new Map(); // poolId → { index }

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Phase 4 (PP-03): pick one endpoint of a pool by its rotation strategy.
 * `healthy` is pre-filtered by the caller (endpoints whose last probe
 * failed are excluded; unprobed endpoints count as usable).
 * round-robin: cycle sequentially (in-memory, resets on restart)
 * latency:     lowest last-probed latency; unprobed counts as slowest
 * sticky:      stable hash of the connection's own config, so one
 *              account keeps one exit until the pool changes
 */
export function pickPoolEndpoint(pool, healthy, stickyKey = "") {
  if (!healthy || healthy.length === 0) return null;
  if (healthy.length === 1) return healthy[0];

  if (pool.rotation === "latency") {
    return [...healthy].sort(
      (a, b) => (a.lastLatencyMs ?? Infinity) - (b.lastLatencyMs ?? Infinity)
    )[0];
  }

  if (pool.rotation === "sticky") {
    return healthy[hashString(`${pool.id}|${stickyKey}`) % healthy.length];
  }

  const state = endpointRotateState.get(pool.id) || { index: -1 };
  state.index = (state.index + 1) % healthy.length;
  endpointRotateState.set(pool.id, state);
  return healthy[state.index];
}

/**
 * Pick one proxy pool ID from a list based on strategy.
 * round-robin: cycle sequentially (in-memory, resets on restart)
 * random:      uniform random pick
 * none/single: return first entry
 */
export function pickProxyPoolId(poolIds, strategy, providerId) {
  if (!poolIds || poolIds.length === 0) return null;
  if (poolIds.length === 1) return poolIds[0];

  if (strategy === "round-robin") {
    const state = rotateState.get(providerId) || { index: -1 };
    state.index = (state.index + 1) % poolIds.length;
    rotateState.set(providerId, state);
    return poolIds[state.index];
  }

  if (strategy === "random") {
    return poolIds[Math.floor(Math.random() * poolIds.length)];
  }

  return poolIds[0]; // "none" or unknown
}

/**
 * Normalize legacy proxy configuration.
 */
function normalizeLegacyProxy(providerSpecificData = {}) {
  const connectionProxyEnabled =
    providerSpecificData?.connectionProxyEnabled === true;

  const connectionProxyUrl = normalizeString(
    providerSpecificData?.connectionProxyUrl
  );

  const connectionNoProxy = normalizeString(
    providerSpecificData?.connectionNoProxy
  );

  return {
    connectionProxyEnabled,
    connectionProxyUrl,
    connectionNoProxy,
  };
}

/**
 * Resolve final proxy configuration.
 *
 * Priority:
 * 1. Proxy Pool
 * 2. Legacy Proxy
 * 3. No Proxy
 */
export async function resolveConnectionProxyConfig(
  providerSpecificData = {}
) {
  try {
    const proxyPoolIdRaw = normalizeString(
      providerSpecificData?.proxyPoolId
    );

    // "__none__" means explicitly disabled
    const proxyPoolId =
      proxyPoolIdRaw === "__none__" ? "" : proxyPoolIdRaw;

    const legacy = normalizeLegacyProxy(providerSpecificData);

    // A strict pool must keep its guarantee even when the pool itself is not
    // usable (inactive, or saved without a url). Otherwise the unusable-pool
    // path below reports strictProxy:false and the request silently leaves
    // over the direct IP — the leak strict mode exists to prevent (#4333).
    let poolStrictProxy = false;

    /**
     * -----------------------------
     * Proxy Pool Resolution
     * -----------------------------
     */
    if (proxyPoolId) {
      const proxyPool = await getProxyPoolById(proxyPoolId);

      let proxyUrl = normalizeString(proxyPool?.proxyUrl);
      let noProxy = normalizeString(proxyPool?.noProxy);

      let isValidPool =
        proxyPool &&
        proxyPool.isActive === true &&
        proxyUrl;

      // Phase 4 (PP-04/PP-07): endpoint pools route through one healthy
      // endpoint chosen by the pool's rotation. Health is advisory, as it
      // was upstream (testStatus never gated routing there): when every
      // endpoint is error-marked, a non-strict pool still routes through
      // its endpoints rather than silently dropping to direct — only a
      // strict pool fails closed in that state (#4333).
      const isRelayPool = proxyPool && ["vercel", "cloudflare", "deno", "netlify"].includes(proxyPool.type);
      if (isValidPool && !isRelayPool) {
        const endpoints = Array.isArray(proxyPool.endpoints) ? proxyPool.endpoints : [];
        if (endpoints.length > 0) {
          const healthy = endpoints.filter((e) => e.testStatus !== "error");
          if (healthy.length === 0 && proxyPool.strictProxy === true) {
            isValidPool = false;
          } else {
            const candidates = healthy.length > 0 ? healthy : endpoints;
            const chosen = pickPoolEndpoint(
              proxyPool,
              candidates,
              JSON.stringify(providerSpecificData || {})
            );
            if (chosen) {
              proxyUrl = normalizeString(chosen.url);
              noProxy = normalizeString(chosen.noProxy) || noProxy;
            }
          }
        }
      }

      poolStrictProxy = proxyPool?.strictProxy === true;

      if (isValidPool) {
        /**
         * Vercel/Cloudflare/Deno/Netlify relay proxies use base URL rewriting
         * instead of HTTP_PROXY environment variables.
         */
        if (proxyPool.type === "vercel" || proxyPool.type === "cloudflare" || proxyPool.type === "deno" || proxyPool.type === "netlify") {
          return {
            source: proxyPool.type,

            proxyPoolId,
            proxyPool,

            connectionProxyEnabled: false,
            connectionProxyUrl: "",
            connectionNoProxy: noProxy,

            strictProxy: proxyPool.strictProxy === true,

            vercelRelayUrl: proxyUrl, // Still mapped to vercelRelayUrl in the unified payload since they use the exact same header spec
          };
        }

        /**
         * Standard proxy pool
         */
        return {
          source: "pool",

          proxyPoolId,
          proxyPool,

          connectionProxyEnabled: true,
          connectionProxyUrl: proxyUrl,
          connectionNoProxy: noProxy,

          strictProxy: proxyPool.strictProxy === true,
        };
      }
    }

    /**
     * -----------------------------
     * Legacy Proxy Fallback
     * -----------------------------
     */
    if (
      legacy.connectionProxyEnabled &&
      legacy.connectionProxyUrl
    ) {
      return {
        source: "legacy",

        proxyPoolId: proxyPoolId || null,
        proxyPool: null,

        strictProxy: poolStrictProxy,

        ...legacy,
      };
    }

    /**
     * -----------------------------
     * No Proxy Config
     * -----------------------------
     */
    return {
      source: "none",

      proxyPoolId: proxyPoolId || null,
      proxyPool: null,

      strictProxy: poolStrictProxy,

      ...legacy,
    };
  } catch (error) {
    console.error(
      "[resolveConnectionProxyConfig] Failed to resolve proxy config:",
      error
    );

    return {
      source: "error",

      proxyPoolId: null,
      proxyPool: null,

      connectionProxyEnabled: false,
      connectionProxyUrl: "",
      connectionNoProxy: "",

      strictProxy: false,
    };
  }
}
