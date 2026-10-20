// Shim → telemetry + quota-snapshot stores (src/lib/db/repos/)
// Used by the request path (open-sse + src/sse) where "@/lib/usageDb.js"
// is the established import pattern for DB-backed request data.
export {
  recordRtk, recordHeadroom,
  recordFallbackEvent, settleFallback,
  getTelemetry, getFallbackSummary, getFallbackWindow, getRtkSummary,
  resetTelemetry,
} from "@/lib/db/repos/telemetryRepo.js";

export {
  recordQuotaSnapshot, getQuotaSnapshot, getAllQuotaSnapshots, resetQuotaSnapshots,
} from "@/lib/db/repos/quotaSnapshotRepo.js";
