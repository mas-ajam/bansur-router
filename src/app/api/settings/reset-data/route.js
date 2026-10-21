import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { resetTelemetry, resetQuotaSnapshots } from "@/lib/telemetry.js";

export const dynamic = "force-dynamic";

// Tables wiped by a router-data reset (PF-11). Settings (including the
// dashboard password) and provider nodes / proxy pools are KEPT.
const RESET_TABLES = [
  "providerConnections",
  "apiKeys",
  "combos",
  "usageHistory",
  "usageDaily",
  "requestDetails",
];

// POST /api/settings/reset-data - Delete all router data (accounts, keys,
// combos, logs). Auth is enforced by src/proxy.js for all /api routes.
export async function POST() {
  try {
    const db = await getAdapter();
    const deleted = {};
    db.transaction(() => {
      for (const table of RESET_TABLES) {
        try {
          const row = db.get(`SELECT COUNT(*) as c FROM ${table}`);
          deleted[table] = row?.c ?? 0;
        } catch { deleted[table] = 0; }
        db.run(`DELETE FROM ${table}`);
      }
    });

    // In-memory usage ring would otherwise keep serving pre-reset rows.
    try {
      if (global._recentRing) global._recentRing.items = [];
    } catch { /* ignore */ }

    await resetTelemetry();
    await resetQuotaSnapshots();

    // The wipe emptied the API-key table. Re-provision the out-of-the-box
    // "Default Key" in this same request — the boot-time provisioning in
    // src/instrumentation.js only runs at server start, and without a key
    // the instance would sit at zero keys (every model test 401s) until a
    // restart. Same calls the /api/keys route uses; never fail the reset
    // over it.
    try {
      const { getApiKeys, createApiKey } = await import("@/lib/localDb");
      const { getConsistentMachineId } = await import("@/shared/utils/machineId");
      const keys = await getApiKeys();
      if (!keys || keys.length === 0) {
        await createApiKey("Default Key", await getConsistentMachineId());
      }
    } catch { /* key re-provisioning is best-effort */ }

    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.log("Error resetting router data:", error);
    return NextResponse.json({ error: "Failed to reset router data" }, { status: 500 });
  }
}
