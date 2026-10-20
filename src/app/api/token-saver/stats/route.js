import { NextResponse } from "next/server";
import { getRtkSummary, getFallbackSummary } from "@/lib/telemetry";

// Phase 4 (O-03 / TS-03 / TS-04): compression + fallback telemetry,
// recorded in-process at the RTK/token-saver stage and at every routing
// fallback transition. The Overview RTK/Fallback cards read the same
// aggregates via /api/usage/stats (period=today); the Token Saver screen
// reads this endpoint directly.
export async function GET() {
  try {
    const [rtk, fallback] = await Promise.all([getRtkSummary(), getFallbackSummary()]);
    return NextResponse.json({ rtk, fallback });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load token saver stats" }, { status: 500 });
  }
}
