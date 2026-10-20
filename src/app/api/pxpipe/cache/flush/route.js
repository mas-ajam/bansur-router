import { NextResponse } from "next/server";
import { flushPxpipeCache } from "@/lib/pxpipe/loader.js";

export const dynamic = "force-dynamic";

// POST - Clear the in-memory PXPIPE transform result cache (PX-04).
export async function POST() {
  try {
    flushPxpipeCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
