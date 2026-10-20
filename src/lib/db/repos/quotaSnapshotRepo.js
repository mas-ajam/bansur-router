// Last-known quota snapshots per provider connection, recorded whenever
// the server itself reads a connection's usage/quota (the
// /api/usage/[connectionId] route). Consumers: the Providers cards
// (plan + remaining %), the "Most quota remaining" routing strategy,
// and the routing record's quota-check field. Snapshots are real
// observed values with a checkedAt stamp — never synthesized.
import { getMeta, setMeta } from "../helpers/metaStore.js";

const META_KEY = "quotaSnapshots.v1";
const PERSIST_DEBOUNCE_MS = 2000;

if (!global._quotaSnapshots) {
  global._quotaSnapshots = { loaded: false, data: {}, chain: Promise.resolve(), persistTimer: null };
}
const store = global._quotaSnapshots;

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

export function recordQuotaSnapshot(connectionId, { plan = null, remainingPct = null } = {}) {
  if (!connectionId) return;
  if (plan == null && remainingPct == null) return;
  store.chain = store.chain.then(async () => {
    await ensureLoaded();
    const prev = store.data[connectionId] || {};
    store.data[connectionId] = {
      plan: plan != null ? String(plan) : prev.plan ?? null,
      remainingPct: typeof remainingPct === "number" && Number.isFinite(remainingPct)
        ? Math.max(0, Math.min(100, Math.round(remainingPct)))
        : prev.remainingPct ?? null,
      checkedAt: new Date().toISOString(),
    };
    schedulePersist();
  }).catch(() => {});
}

export async function getQuotaSnapshot(connectionId) {
  await store.chain;
  await ensureLoaded();
  return store.data[connectionId] || null;
}

export async function getAllQuotaSnapshots() {
  await store.chain;
  await ensureLoaded();
  return store.data;
}

export async function resetQuotaSnapshots() {
  store.chain = store.chain.then(async () => {
    store.data = {};
    schedulePersist();
  }).catch(() => {});
  await store.chain;
}
