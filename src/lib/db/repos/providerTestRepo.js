// Last-test persistence per PROVIDER (Phase 4, D-06): the most recent
// connection-test outcome for each provider, recorded by the test-batch
// and single-test routes. Stored in the _meta key `providerLastTest.v1`
// as a JSON map providerId → { status, latencyMs, statusCode, checkedAt }.
// Only real observed test results are recorded — never synthesized.
import { getMeta, setMeta } from "../helpers/metaStore.js";

const META_KEY = "providerLastTest.v1";
const PERSIST_DEBOUNCE_MS = 2000;

if (!global._providerLastTests) {
  global._providerLastTests = { loaded: false, data: {}, chain: Promise.resolve(), persistTimer: null };
}
const store = global._providerLastTests;

async function ensureLoaded() {
  if (store.loaded) return;
  try {
    const raw = await getMeta(META_KEY, null);
    if (raw) store.data = JSON.parse(raw) || {};
  } catch { /* start empty */ }
  store.loaded = true;
}

function schedulePersist() {
  if (store.persistTimer) return;
  store.persistTimer = setTimeout(() => {
    store.persistTimer = null;
    setMeta(META_KEY, JSON.stringify(store.data)).catch(() => {});
  }, PERSIST_DEBOUNCE_MS);
  store.persistTimer?.unref?.();
}

export function recordProviderTest(providerId, result = {}) {
  if (!providerId) return;
  const entry = {
    status: result.status === "ok" || result.valid === true ? "ok" : "error",
    latencyMs: typeof result.latencyMs === "number" && Number.isFinite(result.latencyMs)
      ? Math.max(0, Math.round(result.latencyMs))
      : null,
    statusCode: typeof result.statusCode === "number" && Number.isFinite(result.statusCode)
      ? result.statusCode
      : null,
    checkedAt: result.checkedAt || result.testedAt || new Date().toISOString(),
  };
  store.chain = store.chain.then(async () => {
    await ensureLoaded();
    store.data[providerId] = entry;
    schedulePersist();
  }).catch(() => {});
}

export async function getProviderLastTests() {
  await store.chain;
  await ensureLoaded();
  return store.data;
}

export async function getProviderLastTest(providerId) {
  const all = await getProviderLastTests();
  return all[providerId] || null;
}
