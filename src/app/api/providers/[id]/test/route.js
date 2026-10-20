import { NextResponse } from "next/server";
import { testSingleConnection } from "./testUtils.js";
import { getProviderConnectionById, recordProviderTest } from "@/lib/localDb";

// POST /api/providers/[id]/test - Test connection
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = await testSingleConnection(id);

    if (result.error === "Connection not found") {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // D-06: persist per-provider last test for the detail page.
    try {
      const connection = await getProviderConnectionById(id);
      if (connection?.provider) {
        recordProviderTest(connection.provider, {
          status: result.valid ? "ok" : "error",
          latencyMs: result.latencyMs || 0,
          statusCode: result.statusCode || null,
          checkedAt: result.testedAt || new Date().toISOString(),
        });
      }
    } catch { /* persistence must never break testing */ }

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      refreshed: result.refreshed || false,
      latencyMs: result.latencyMs || 0,
      testedAt: result.testedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.log("Error testing connection:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
