import { NextResponse } from "next/server";
import { getProxyPoolById, updateProxyPool, recordPoolEndpointTests } from "@/models";
import { testProxyUrl } from "@/lib/network/proxyTest";
import { fetch as undiciFetch } from "undici";

async function testVercelRelay(relayUrl, timeoutMs = 10000) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await undiciFetch(relayUrl, {
      method: "GET",
      headers: {
        "x-relay-target": "https://httpbin.org",
        "x-relay-path": "/get",
      },
      signal: controller.signal,
    });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err?.name === "AbortError" ? "Relay test timed out" : (err?.message || String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/proxy-pools/[id]/test - Test proxy pool entry
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const proxyPool = await getProxyPoolById(id);

    if (!proxyPool) {
      return NextResponse.json({ error: "Proxy pool not found" }, { status: 404 });
    }

    // Phase 4 (PP-05): endpoint pools probe every endpoint and persist
    // per-endpoint health; the pool result aggregates (ok when at least
    // one endpoint is healthy). Probing no longer flips isActive.
    if (proxyPool.type === "http" && Array.isArray(proxyPool.endpoints) && proxyPool.endpoints.length > 0) {
      const testedAt = new Date().toISOString();
      const results = await Promise.all(
        proxyPool.endpoints.map(async (e) => {
          const r = await testProxyUrl({ proxyUrl: e.url });
          return {
            url: e.url,
            ok: r.ok,
            status: r.status,
            error: r.error || null,
            latencyMs: typeof r.elapsedMs === "number" ? r.elapsedMs : null,
            testedAt,
          };
        })
      );
      await recordPoolEndpointTests(id, results);
      const okCount = results.filter((r) => r.ok).length;
      return NextResponse.json({
        ok: okCount > 0,
        status: results[0]?.status || null,
        statusText: null,
        error: okCount > 0 ? null : (results[0]?.error || "All endpoints failed"),
        elapsedMs: Math.max(0, ...results.map((r) => r.latencyMs || 0)),
        testedAt,
        endpoints: results,
      });
    }

    const result = proxyPool.type === "vercel" || proxyPool.type === "cloudflare" || proxyPool.type === "deno" || proxyPool.type === "netlify"
      ? await testVercelRelay(proxyPool.proxyUrl)
      : await testProxyUrl({ proxyUrl: proxyPool.proxyUrl });
    const now = new Date().toISOString();

    await updateProxyPool(id, {
      testStatus: result.ok ? "active" : "error",
      lastTestedAt: now,
      lastError: result.ok ? null : (result.error || `Proxy test failed with status ${result.status}`),
      isActive: result.ok,
    });

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      statusText: result.statusText || null,
      error: result.error || null,
      elapsedMs: result.elapsedMs || 0,
      testedAt: now,
    });
  } catch (error) {
    console.log("Error testing proxy pool:", error);
    return NextResponse.json({ error: "Failed to test proxy pool" }, { status: 500 });
  }
}
