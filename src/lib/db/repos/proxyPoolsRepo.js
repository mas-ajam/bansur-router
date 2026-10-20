import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const ROTATIONS = ["round-robin", "latency", "sticky"];

// Phase 4 (PP-03/PP-04): a pool owns a list of endpoints plus a rotation
// strategy. Both live in the JSON `data` column, so no schema change is
// needed. Legacy pools saved with a single `proxyUrl` are presented as
// a one-endpoint pool; the two shapes stay in sync on write.
export function normalizePoolEndpoints(pool) {
  if (!pool) return pool;
  let endpoints = Array.isArray(pool.endpoints)
    ? pool.endpoints.filter((e) => e && typeof e.url === "string" && e.url.trim())
    : [];
  if (endpoints.length === 0 && pool.proxyUrl) {
    endpoints = [{
      url: pool.proxyUrl,
      noProxy: pool.noProxy || "",
      testStatus: pool.testStatus && pool.testStatus !== "unknown" ? pool.testStatus : null,
      lastTestedAt: pool.lastTestedAt || null,
      lastError: pool.lastError || null,
      lastLatencyMs: null,
    }];
  }
  pool.endpoints = endpoints.map((e) => ({
    url: e.url,
    noProxy: e.noProxy || "",
    testStatus: e.testStatus || null,
    lastTestedAt: e.lastTestedAt || null,
    lastError: e.lastError || null,
    lastLatencyMs: typeof e.lastLatencyMs === "number" ? e.lastLatencyMs : null,
  }));
  pool.rotation = ROTATIONS.includes(pool.rotation) ? pool.rotation : "round-robin";
  pool.description = typeof pool.description === "string" ? pool.description : "";
  return pool;
}

function rowToPool(row) {
  if (!row) return null;
  const extra = parseJson(row.data, {});
  return normalizePoolEndpoints({
    ...extra,
    id: row.id,
    isActive: row.isActive === 1 || row.isActive === true,
    testStatus: row.testStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function poolToRow(p) {
  const { id, isActive, testStatus, createdAt, updatedAt, ...rest } = p;
  return {
    id,
    isActive: isActive === false ? 0 : 1,
    testStatus: testStatus ?? null,
    data: stringifyJson(rest),
    createdAt,
    updatedAt,
  };
}

function upsert(db, p) {
  const r = poolToRow(p);
  db.run(
    `INSERT INTO proxyPools(id, isActive, testStatus, data, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       isActive=excluded.isActive, testStatus=excluded.testStatus,
       data=excluded.data, updatedAt=excluded.updatedAt`,
    [r.id, r.isActive, r.testStatus, r.data, r.createdAt, r.updatedAt]
  );
}

export async function getProxyPools(filter = {}) {
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filter.isActive !== undefined) { where.push("isActive = ?"); params.push(filter.isActive ? 1 : 0); }
  if (filter.testStatus) { where.push("testStatus = ?"); params.push(filter.testStatus); }
  const sql = `SELECT * FROM proxyPools${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
  const list = db.all(sql, params).map(rowToPool);
  list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return list;
}

export async function getProxyPoolById(id) {
  const db = await getAdapter();
  return rowToPool(db.get(`SELECT * FROM proxyPools WHERE id = ?`, [id]));
}

export async function createProxyPool(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const endpoints = Array.isArray(data.endpoints)
    ? data.endpoints.filter((e) => e && typeof e.url === "string" && e.url.trim())
    : [];
  const pool = {
    id: data.id || uuidv4(),
    name: data.name,
    proxyUrl: endpoints[0]?.url || data.proxyUrl,
    noProxy: data.noProxy || "",
    type: data.type || "http",
    isActive: data.isActive !== undefined ? data.isActive : true,
    strictProxy: data.strictProxy === true,
    endpoints,
    rotation: ROTATIONS.includes(data.rotation) ? data.rotation : "round-robin",
    description: typeof data.description === "string" ? data.description : "",
    testStatus: data.testStatus || "unknown",
    lastTestedAt: data.lastTestedAt || null,
    lastError: data.lastError || null,
    createdAt: now,
    updatedAt: now,
  };
  upsert(db, pool);
  return normalizePoolEndpoints(pool);
}

export async function updateProxyPool(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM proxyPools WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToPool(row), ...data, updatedAt: new Date().toISOString() };
    // Keep the legacy single-URL field in sync with the endpoint list.
    if (Array.isArray(merged.endpoints) && merged.endpoints.length > 0) {
      merged.proxyUrl = merged.endpoints[0].url;
    }
    upsert(db, merged);
    result = normalizePoolEndpoints(merged);
  });
  return result;
}

export async function deleteProxyPool(id) {
  const db = await getAdapter();
  let removed = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM proxyPools WHERE id = ?`, [id]);
    if (!row) return;
    removed = rowToPool(row);
    db.run(`DELETE FROM proxyPools WHERE id = ?`, [id]);
  });
  return removed;
}

// Phase 4 (PP-05/PP-07): persist a health-probe round for a pool.
// results: [{ url, ok, error, latencyMs, testedAt }] — merged into the
// pool's endpoints by URL; the pool-level testStatus aggregates to
// "active" when at least one endpoint is healthy, else "error".
// Probing never flips isActive: a transient failure must not disable
// a pool the user enabled (the router skips unhealthy pools itself).
export async function recordPoolEndpointTests(poolId, results) {
  const pool = await getProxyPoolById(poolId);
  if (!pool) return null;
  const byUrl = new Map((results || []).map((r) => [r.url, r]));
  const endpoints = (pool.endpoints || []).map((e) => {
    const r = byUrl.get(e.url);
    if (!r) return e;
    return {
      ...e,
      testStatus: r.ok ? "active" : "error",
      lastTestedAt: r.testedAt || new Date().toISOString(),
      lastError: r.ok ? null : (r.error || "Proxy test failed"),
      lastLatencyMs: typeof r.latencyMs === "number" ? r.latencyMs : null,
    };
  });
  const healthy = endpoints.filter((e) => e.testStatus === "active").length;
  const firstError = endpoints.find((e) => e.testStatus === "error")?.lastError || null;
  return updateProxyPool(poolId, {
    endpoints,
    testStatus: endpoints.length === 0 ? pool.testStatus : healthy > 0 ? "active" : "error",
    lastTestedAt: new Date().toISOString(),
    lastError: healthy > 0 ? null : firstError,
  });
}
