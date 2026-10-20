// Telemetry store (Phase 4): real, observed-only aggregates behind the
// dashboard's class-C displays — RTK/headroom compression stats and the
// fallback-event log. Nothing here is estimated from thin air beyond the
// codebase's own chars→tokens convention (4 chars/token, same as pxpipe):
// RTK measures compressed tool-output text in chars; token figures are
// that convention applied to measured char counts.
//
// State lives in memory (global, shared across Next modules) and is
// persisted debounced to _meta as one JSON document. Mutations are
// serialized on a promise chain so concurrent request handlers can't
// interleave a load/modify cycle.
import { getMeta, setMeta } from "../helpers/metaStore.js";

const META_KEY = "telemetry.v1";
const PERSIST_DEBOUNCE_MS = 2000;
const RECENT_CAP = 200;
const CHARS_PER_TOKEN = 4;

const estTokens = (chars) => Math.round((chars || 0) / CHARS_PER_TOKEN);

function dateKeyOf(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyRtkDay() {
  return { calls: 0, charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, tokensSaved: 0, byType: {} };
}

function emptyFallbackDay() {
  return { events: 0, recovered: 0, timeSavedMs: 0 };
}

function emptyState() {
  return {
    rtk: { days: {}, totals: emptyRtkDay() },
    headroom: { days: {}, totals: { calls: 0, tokensSaved: 0 } },
    fallback: {
      totalEvents: 0,
      totalRecovered: 0,
      totalTimeSavedMs: 0,
      lastAt: null,
      lastReason: null,
      days: {},
      recent: [],
    },
  };
}

if (!global._telemetryState) {
  global._telemetryState = { loaded: false, data: emptyState(), chain: Promise.resolve(), persistTimer: null };
}
const store = global._telemetryState;

async function ensureLoaded() {
  if (store.loaded) return;
  try {
    const raw = await getMeta(META_KEY, null);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = emptyState();
      store.data = {
        rtk: { days: parsed.rtk?.days || {}, totals: { ...emptyRtkDay(), ...(parsed.rtk?.totals || {}) } },
        headroom: { days: parsed.headroom?.days || {}, totals: { calls: 0, tokensSaved: 0, ...(parsed.headroom?.totals || {}) } },
        fallback: { ...base.fallback, ...(parsed.fallback || {}), days: parsed.fallback?.days || {}, recent: parsed.fallback?.recent || [] },
      };
    }
  } catch { /* start empty on any read failure */ }
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

function mutate(fn) {
  store.chain = store.chain.then(async () => {
    await ensureLoaded();
    try { fn(store.data); } catch { /* telemetry must never break requests */ }
    schedulePersist();
  }).catch(() => {});
  return store.chain;
}

export function recordRtk({ charsIn = 0, charsOut = 0, hits = [] } = {}) {
  if (!charsIn && !hits.length) return;
  mutate((data) => {
    const key = dateKeyOf();
    const day = (data.rtk.days[key] ||= emptyRtkDay());
    const tokensIn = estTokens(charsIn);
    const tokensOut = estTokens(charsOut);
    for (const bucket of [day, data.rtk.totals]) {
      bucket.calls += 1;
      bucket.charsIn += charsIn;
      bucket.charsOut += charsOut;
      bucket.tokensIn += tokensIn;
      bucket.tokensOut += tokensOut;
      bucket.tokensSaved += Math.max(0, tokensIn - tokensOut);
    }
    for (const hit of hits) {
      const type = hit.filter || "unknown";
      const hitIn = hit.charsIn || 0;
      const hitSavedChars = hit.saved || 0;
      const hitOut = Math.max(0, hitIn - hitSavedChars);
      for (const bucket of [day, data.rtk.totals]) {
        const t = (bucket.byType[type] ||= { calls: 0, charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, tokensSaved: 0 });
        t.calls += 1;
        t.charsIn += hitIn;
        t.charsOut += hitOut;
        t.tokensIn += estTokens(hitIn);
        t.tokensOut += estTokens(hitOut);
        t.tokensSaved += Math.max(0, estTokens(hitIn) - estTokens(hitOut));
      }
    }
  });
}

export function recordHeadroom({ tokensSaved = 0 } = {}) {
  if (!tokensSaved) return;
  mutate((data) => {
    const key = dateKeyOf();
    const day = (data.headroom.days[key] ||= { calls: 0, tokensSaved: 0 });
    day.calls += 1;
    day.tokensSaved += tokensSaved;
    data.headroom.totals.calls += 1;
    data.headroom.totals.tokensSaved += tokensSaved;
  });
}

// One fallback transition (an account was abandoned for the next account,
// or a combo step was abandoned for the next model). `avoidedWaitMs` is
// the cooldown the failed account/model actually entered — the wait the
// client avoided by switching immediately. It is only credited to
// "time saved" when the request ultimately succeeds (settleFallback).
export function recordFallbackEvent({ reqId = null, kind, provider = null, model = null, comboName = null, connectionId = null, status = null, reason = null, avoidedWaitMs = 0 } = {}) {
  mutate((data) => {
    const now = Date.now();
    const key = dateKeyOf(now);
    const day = (data.fallback.days[key] ||= emptyFallbackDay());
    day.events += 1;
    data.fallback.totalEvents += 1;
    data.fallback.lastAt = new Date(now).toISOString();
    data.fallback.lastReason = reason ? String(reason).slice(0, 120) : null;
    data.fallback.recent.push({
      reqId, ts: data.fallback.lastAt, kind: kind || "account",
      provider, model, comboName, connectionId, status,
      reason: data.fallback.lastReason,
      avoidedWaitMs: Math.max(0, avoidedWaitMs || 0),
      recovered: null,
    });
    if (data.fallback.recent.length > RECENT_CAP) {
      data.fallback.recent = data.fallback.recent.slice(-RECENT_CAP);
    }
  });
}

// Mark every unsettled event of a request once its final outcome is
// known. Recovered events credit their avoided wait to "time saved".
export function settleFallback(reqId, recovered) {
  if (!reqId) return;
  mutate((data) => {
    for (const ev of data.fallback.recent) {
      if (ev.reqId !== reqId || ev.recovered !== null) continue;
      ev.recovered = !!recovered;
      if (recovered) {
        const key = dateKeyOf(new Date(ev.ts).getTime());
        const day = (data.fallback.days[key] ||= emptyFallbackDay());
        day.recovered += 1;
        day.timeSavedMs += ev.avoidedWaitMs || 0;
        data.fallback.totalRecovered += 1;
        data.fallback.totalTimeSavedMs += ev.avoidedWaitMs || 0;
      }
    }
  });
}

export async function getTelemetry() {
  await store.chain;
  await ensureLoaded();
  return store.data;
}

export async function getFallbackSummary() {
  const data = await getTelemetry();
  const today = data.fallback.days[dateKeyOf()] || emptyFallbackDay();
  return {
    today: { events: today.events, recovered: today.recovered, timeSavedMs: today.timeSavedMs },
    totals: {
      events: data.fallback.totalEvents,
      recovered: data.fallback.totalRecovered,
      timeSavedMs: data.fallback.totalTimeSavedMs,
    },
    lastAt: data.fallback.lastAt,
    lastReason: data.fallback.lastReason,
    recent: data.fallback.recent.slice(-20).reverse(),
  };
}

// Sum fallback days across an inclusive list of date keys (period windows).
export async function getFallbackWindow(dateKeys) {
  const data = await getTelemetry();
  const out = { events: 0, recovered: 0, timeSavedMs: 0 };
  for (const key of dateKeys || []) {
    const day = data.fallback.days[key];
    if (!day) continue;
    out.events += day.events || 0;
    out.recovered += day.recovered || 0;
    out.timeSavedMs += day.timeSavedMs || 0;
  }
  return out;
}

export async function getRtkSummary() {
  const data = await getTelemetry();
  const todayKey = dateKeyOf();
  const today = data.rtk.days[todayKey] || emptyRtkDay();
  const headroomToday = data.headroom.days[todayKey] || { calls: 0, tokensSaved: 0 };
  return {
    today: { ...today, headroom: headroomToday },
    totals: { ...data.rtk.totals, headroom: data.headroom.totals },
    days: data.rtk.days,
  };
}

export async function resetTelemetry() {
  await mutate((data) => {
    const fresh = emptyState();
    data.rtk = fresh.rtk;
    data.headroom = fresh.headroom;
    data.fallback = fresh.fallback;
  });
  await store.chain;
  try { await setMeta(META_KEY, JSON.stringify(store.data)); } catch { /* ignore */ }
}
