import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function GET() {
  // Phase 4 (SE-01/PF-04): health carries the effective runtime identity —
  // uptime, the actual bound port and the persisted instance name — so the
  // dashboard (and external probes) see what the server really runs as.
  let instanceName = null;
  try {
    const settings = await getSettings();
    instanceName = settings.instanceName || settings.displayName || null;
  } catch { /* health must never fail on settings reads */ }
  return NextResponse.json({
    ok: true,
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    port: Number(process.env.PORT) || null,
    instanceName,
  }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
