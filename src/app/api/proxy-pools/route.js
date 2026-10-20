import { NextResponse } from "next/server";
import { createProxyPool, getProviderConnections, getProxyPools } from "@/models";

function toBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

const VALID_PROXY_TYPES = ["http", "vercel", "cloudflare", "deno", "netlify"];

const VALID_ROTATIONS = ["round-robin", "latency", "sticky"];

function normalizeEndpoints(body = {}) {
  const raw = Array.isArray(body?.endpoints) ? body.endpoints : [];
  const endpoints = raw
    .map((e) => ({
      url: typeof e?.url === "string" ? e.url.trim() : "",
      noProxy: typeof e?.noProxy === "string" ? e.noProxy.trim() : "",
    }))
    .filter((e) => e.url);
  // Legacy single-URL input becomes a one-endpoint pool.
  if (endpoints.length === 0 && typeof body?.proxyUrl === "string" && body.proxyUrl.trim()) {
    endpoints.push({ url: body.proxyUrl.trim(), noProxy: typeof body?.noProxy === "string" ? body.noProxy.trim() : "" });
  }
  return endpoints;
}

function normalizeProxyPoolInput(body = {}) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const endpoints = normalizeEndpoints(body);
  const proxyUrl = endpoints[0]?.url || "";
  const noProxy = typeof body?.noProxy === "string" ? body.noProxy.trim() : "";
  const isActive = body?.isActive === undefined ? true : body.isActive === true;
  const strictProxy = body?.strictProxy === true;
  const type = VALID_PROXY_TYPES.includes(body?.type) ? body.type : "http";
  const rotation = VALID_ROTATIONS.includes(body?.rotation) ? body.rotation : "round-robin";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) {
    return { error: "Name is required" };
  }

  if (!proxyUrl) {
    return { error: "Proxy URL is required" };
  }

  return { name, proxyUrl, noProxy, isActive, strictProxy, type, endpoints, rotation, description };
}

function connectionPoolId(connection) {
  const data = connection?.providerSpecificData || {};
  return data.proxyPoolId || data.connectionProxyPoolId || null;
}

function buildUsageMap(connections = []) {
  const usageMap = new Map();

  for (const connection of connections) {
    const proxyPoolId = connectionPoolId(connection);
    if (!proxyPoolId) continue;

    const entry = usageMap.get(proxyPoolId) || { count: 0, usedBy: [] };
    entry.count += 1;
    // PP-06: used-by carries the bound providers (names resolved
    // client-side from the provider registry), deduplicated.
    if (connection.provider && !entry.usedBy.includes(connection.provider)) {
      entry.usedBy.push(connection.provider);
    }
    usageMap.set(proxyPoolId, entry);
  }

  return usageMap;
}

// GET /api/proxy-pools - List proxy pools
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = toBoolean(searchParams.get("isActive"));
    const includeUsage = searchParams.get("includeUsage") === "true";

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const proxyPools = await getProxyPools(filter);

    if (!includeUsage) {
      return NextResponse.json({ proxyPools });
    }

    const connections = await getProviderConnections();
    const usageMap = buildUsageMap(connections);

    const enrichedProxyPools = proxyPools.map((pool) => {
      const usage = usageMap.get(pool.id) || { count: 0, usedBy: [] };
      return {
        ...pool,
        boundConnectionCount: usage.count,
        usedBy: usage.usedBy,
      };
    });

    return NextResponse.json({ proxyPools: enrichedProxyPools });
  } catch (error) {
    console.log("Error fetching proxy pools:", error);
    return NextResponse.json({ error: "Failed to fetch proxy pools" }, { status: 500 });
  }
}

// POST /api/proxy-pools - Create proxy pool
export async function POST(request) {
  try {
    const body = await request.json();
    const normalized = normalizeProxyPoolInput(body);

    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const proxyPool = await createProxyPool(normalized);
    return NextResponse.json({ proxyPool }, { status: 201 });
  } catch (error) {
    console.log("Error creating proxy pool:", error);
    return NextResponse.json({ error: "Failed to create proxy pool" }, { status: 500 });
  }
}
