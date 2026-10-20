import { NextResponse } from "next/server";
import {
  deleteProxyPool,
  getProviderConnections,
  getProxyPoolById,
  updateProxyPool,
} from "@/models";

function normalizeProxyPoolUpdate(body = {}) {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return { error: "Name is required" };
    }
    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "proxyUrl")) {
    const proxyUrl = typeof body?.proxyUrl === "string" ? body.proxyUrl.trim() : "";
    if (!proxyUrl) {
      return { error: "Proxy URL is required" };
    }
    updates.proxyUrl = proxyUrl;
  }

  if (Object.prototype.hasOwnProperty.call(body, "noProxy")) {
    updates.noProxy = typeof body?.noProxy === "string" ? body.noProxy.trim() : "";
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    updates.isActive = body?.isActive === true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "strictProxy")) {
    updates.strictProxy = body?.strictProxy === true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "type")) {
    const validTypes = ["http", "vercel", "cloudflare", "deno", "netlify"];
    updates.type = validTypes.includes(body?.type) ? body.type : "http";
  }

  if (Object.prototype.hasOwnProperty.call(body, "endpoints")) {
    const raw = Array.isArray(body?.endpoints) ? body.endpoints : [];
    const endpoints = raw
      .map((e) => ({
        url: typeof e?.url === "string" ? e.url.trim() : "",
        noProxy: typeof e?.noProxy === "string" ? e.noProxy.trim() : "",
        // Preserve prior probe results for endpoints that survive the edit.
        testStatus: e?.testStatus || null,
        lastTestedAt: e?.lastTestedAt || null,
        lastError: e?.lastError || null,
        lastLatencyMs: typeof e?.lastLatencyMs === "number" ? e.lastLatencyMs : null,
      }))
      .filter((e) => e.url);
    if (endpoints.length === 0) {
      return { error: "At least one endpoint URL is required" };
    }
    updates.endpoints = endpoints;
    updates.proxyUrl = endpoints[0].url;
  }

  if (Object.prototype.hasOwnProperty.call(body, "rotation")) {
    const validRotations = ["round-robin", "latency", "sticky"];
    updates.rotation = validRotations.includes(body?.rotation) ? body.rotation : "round-robin";
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = typeof body?.description === "string" ? body.description.trim() : "";
  }

  return { updates };
}

function countBoundConnections(connections = [], proxyPoolId) {
  return connections.filter((connection) => {
    const data = connection?.providerSpecificData || {};
    return data.proxyPoolId === proxyPoolId || data.connectionProxyPoolId === proxyPoolId;
  }).length;
}

// GET /api/proxy-pools/[id] - Get proxy pool
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const proxyPool = await getProxyPoolById(id);

    if (!proxyPool) {
      return NextResponse.json({ error: "Proxy pool not found" }, { status: 404 });
    }

    return NextResponse.json({ proxyPool });
  } catch (error) {
    console.log("Error fetching proxy pool:", error);
    return NextResponse.json({ error: "Failed to fetch proxy pool" }, { status: 500 });
  }
}

// PUT /api/proxy-pools/[id] - Update proxy pool
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getProxyPoolById(id);

    if (!existing) {
      return NextResponse.json({ error: "Proxy pool not found" }, { status: 404 });
    }

    const body = await request.json();
    const normalized = normalizeProxyPoolUpdate(body);

    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const updated = await updateProxyPool(id, normalized.updates);
    return NextResponse.json({ proxyPool: updated });
  } catch (error) {
    console.log("Error updating proxy pool:", error);
    return NextResponse.json({ error: "Failed to update proxy pool" }, { status: 500 });
  }
}

// DELETE /api/proxy-pools/[id] - Delete proxy pool
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getProxyPoolById(id);

    if (!existing) {
      return NextResponse.json({ error: "Proxy pool not found" }, { status: 404 });
    }

    const connections = await getProviderConnections();
    const boundConnectionCount = countBoundConnections(connections, id);

    if (boundConnectionCount > 0) {
      return NextResponse.json(
        {
          error: "Proxy pool is currently in use",
          boundConnectionCount,
        },
        { status: 409 }
      );
    }

    await deleteProxyPool(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting proxy pool:", error);
    return NextResponse.json({ error: "Failed to delete proxy pool" }, { status: 500 });
  }
}
