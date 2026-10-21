import { pathToFileURL } from "url";
import crypto from "crypto";
import { getInstallInfo, libraryEntry } from "./install.js";

// Module cache: pxpipe is loaded once per process ("started") and dropped on
// "stop". In library mode start/stop govern the in-process module, not a daemon.
let cached = null; // { module, version, loadedAt }
let loadPromise = null;

export function getLoadedInfo() {
  return cached ? { loaded: true, version: cached.version, loadedAt: cached.loadedAt } : { loaded: false };
}

export async function loadPxpipe() {
  if (cached) return cached;
  if (loadPromise) return loadPromise;
  loadPromise = doLoad().finally(() => { loadPromise = null; });
  return loadPromise;
}

async function doLoad() {
  const info = getInstallInfo();
  if (!info.installed) {
    const err = new Error("PXPIPE is not installed");
    err.code = "NOT_INSTALLED";
    throw err;
  }
  // Cache-bust per version so Repair/upgrade takes effect without a server restart.
  const url = `${pathToFileURL(libraryEntry()).href}?v=${encodeURIComponent(info.version || "0")}`;
  const mod = await import(/* webpackIgnore: true */ url);
  if (typeof mod.transformAnthropicMessages !== "function") {
    throw new Error("installed pxpipe package does not export transformAnthropicMessages");
  }
  cached = { module: mod, version: info.version, loadedAt: Date.now() };
  return cached;
}

export function unloadPxpipe() {
  const wasLoaded = !!cached;
  cached = null;
  return wasLoaded;
}

// --- PXPIPE transform result cache (PX-04) ---------------------------------
// Real result cache around the raw transform: requests whose encoded body,
// model and full transform options are identical within the TTL reuse the
// previous transform result instead of re-rendering images. In-memory only;
// counters back getPxpipeCacheStats() for the status payload.
const DEFAULT_CACHE_TTL_SEC = 300;
const DEFAULT_MAX_PAYLOAD_MB = 32;

const transformCache = new Map(); // sha256 key -> { result, expiresAt }
let cacheHits = 0;
let cacheMisses = 0;

export function getPxpipeCacheStats() {
  return { hits: cacheHits, misses: cacheMisses, size: transformCache.size };
}

export function flushPxpipeCache() {
  transformCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

async function readCacheSettings() {
  try {
    const { getSettings } = await import("@/lib/localDb");
    const settings = await getSettings();
    const ttlSec = Number(settings?.pxpipeCacheTtlSec);
    const maxPayloadMb = Number(settings?.pxpipeMaxPayloadMb);
    return {
      ttlSec: Number.isFinite(ttlSec) && ttlSec >= 0 ? ttlSec : DEFAULT_CACHE_TTL_SEC,
      maxPayloadMb: Number.isFinite(maxPayloadMb) && maxPayloadMb >= 0 ? maxPayloadMb : DEFAULT_MAX_PAYLOAD_MB,
    };
  } catch {
    return { ttlSec: DEFAULT_CACHE_TTL_SEC, maxPayloadMb: DEFAULT_MAX_PAYLOAD_MB };
  }
}

function cloneTransformResult(result) {
  try {
    return structuredClone(result);
  } catch {
    return JSON.parse(JSON.stringify(result));
  }
}

function wrapTransformWithCache(transformFn) {
  return async function cachedTransform(args) {
    const { body, model, options } = args || {};
    const { ttlSec, maxPayloadMb } = await readCacheSettings();
    const ttlMs = ttlSec * 1000;
    const maxPayloadBytes = maxPayloadMb * 1024 * 1024;

    // The transform receives the body as UTF-8 JSON bytes; its byte length is
    // the JSON payload length the payload cap applies to.
    const bodyBytes = body instanceof Uint8Array
      ? body.byteLength
      : (JSON.stringify(body) || "").length;

    // Cache disabled (TTL or cap set to 0) or oversized payload: skip the
    // cache entirely — no lookup, no store, no counters.
    if (!(ttlMs > 0) || !(maxPayloadBytes > 0) || bodyBytes > maxPayloadBytes) {
      return transformFn(args);
    }

    const bodyJson = body instanceof Uint8Array
      ? Buffer.from(body).toString("utf8")
      : JSON.stringify(body);
    // Key on the FULL options object, not just minCompressChars: any other
    // option the transform reads must also partition the cache, or a result
    // produced under different options could be served as fresh.
    const optionsJson = (() => {
      if (!options || typeof options !== "object") return "";
      try {
        return JSON.stringify(options, Object.keys(options).sort());
      } catch {
        return String(options?.minCompressChars ?? "");
      }
    })();
    const key = crypto
      .createHash("sha256")
      .update(bodyJson || "")
      .update("\0")
      .update(String(model || ""))
      .update("\0")
      .update(optionsJson)
      .digest("hex");

    const entry = transformCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        cacheHits++;
        const copy = cloneTransformResult(entry.result);
        if (copy && typeof copy === "object") copy.cacheHit = true;
        return copy;
      }
      transformCache.delete(key); // expired
    }

    cacheMisses++;
    const result = await transformFn(args);
    if (result && typeof result === "object") {
      try {
        transformCache.set(key, { result: cloneTransformResult(result), expiresAt: Date.now() + ttlMs });
      } catch { /* uncloneable result: serve it uncached */ }
    }
    return result;
  };
}

// Transform function for the request pipeline; null when unavailable (fail-open).
// autoLoad controls whether a cold cache triggers a load (first request warms it).
export async function getTransform({ autoLoad = true } = {}) {
  try {
    if (!cached && !autoLoad) return null;
    const { module: mod } = await loadPxpipe();
    return wrapTransformWithCache(mod.transformAnthropicMessages);
  } catch {
    return null;
  }
}

// Health self-test: run a tiny synthetic Claude request through the transformer.
// A healthy module parses it and answers with a machine-readable reason.
export async function selfTest() {
  const startedAt = Date.now();
  const { module: mod } = await loadPxpipe();
  const body = new TextEncoder().encode(JSON.stringify({
    model: "claude-fable-5",
    max_tokens: 16,
    messages: [{ role: "user", content: "ping" }],
  }));
  const result = await mod.transformAnthropicMessages({ body, model: "claude-fable-5" });
  if (!result || typeof result.applied !== "boolean" || !(result.body instanceof Uint8Array)) {
    throw new Error("transform returned an unexpected shape");
  }
  return { ok: true, reason: result.reason, durationMs: Date.now() - startedAt };
}
