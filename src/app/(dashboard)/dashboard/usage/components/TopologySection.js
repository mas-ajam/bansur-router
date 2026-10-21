"use client";

// Option 2 restoration (batch 3, U-05): the ProviderTopology graph,
// removed from the Usage page in phase 3, returns as an additional
// section under the spec 7-day content. Data wiring is the pre-removal
// one (UsageStats): the provider list comes from /api/providers +
// /api/provider-nodes (deduped by provider type, noAuth free providers
// always included) and live activity (activeRequests / last provider /
// error provider) streams from /api/usage/stream (SSE), merged over a
// one-shot /api/usage/stats read for the initial last/error provider.
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/shared/components";
import { FREE_PROVIDERS, AI_PROVIDERS } from "@/shared/constants/providers";

const ProviderTopology = dynamic(() => import("./ProviderTopology"), { ssr: false });

// Keep providers without serviceKinds (default LLM) or with "llm" in serviceKinds
function isLLMProvider(id) {
  const p = AI_PROVIDERS[id];
  if (!p?.serviceKinds) return true;
  return p.serviceKinds.includes("llm");
}

export default function TopologySection() {
  const [providers, setProviders] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [lastProvider, setLastProvider] = useState("");
  const [errorProvider, setErrorProvider] = useState("");

  // Fetch connected providers once, deduplicate by provider type
  // Always include noAuth free providers (e.g. opencode) regardless of connections
  useEffect(() => {
    Promise.all([
      fetch("/api/providers").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/provider-nodes").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, nodesData]) => {
        // Build node name lookup for custom providers
        const nodeNameMap = {};
        for (const node of nodesData?.nodes || []) {
          nodeNameMap[node.id] = node.name;
        }
        const seen = new Set();
        const unique = (d?.connections || [])
          .filter((c) => {
            if (c.isActive === false) return false;
            if (!isLLMProvider(c.provider)) return false;
            if (AI_PROVIDERS[c.provider]?.hidden) return false;
            if (seen.has(c.provider)) return false;
            seen.add(c.provider);
            return true;
          })
          .map((c) => ({
            ...c,
            nodeName: nodeNameMap[c.provider] || null,
          }));
        const noAuthProviders = Object.values(FREE_PROVIDERS)
          .filter((p) => p.noAuth && !p.hidden && !seen.has(p.id) && isLLMProvider(p.id))
          .map((p) => ({ provider: p.id, name: p.name }));
        setProviders([...unique, ...noAuthProviders]);
      })
      .catch(() => {});
  }, []);

  // Initial last/error provider from a one-shot stats read
  useEffect(() => {
    fetch("/api/usage/stats?period=7d")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.recentRequests?.[0]?.provider) setLastProvider(data.recentRequests[0].provider);
        if (data.errorProvider) setErrorProvider(data.errorProvider);
        if (Array.isArray(data.activeRequests)) setActiveRequests(data.activeRequests);
      })
      .catch(() => {});
  }, []);

  // SSE connection - real-time updates for activeRequests + recentRequests only
  useEffect(() => {
    const es = new EventSource("/api/usage/stream");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data.activeRequests)) setActiveRequests(data.activeRequests);
        if (data.recentRequests?.[0]?.provider) setLastProvider(data.recentRequests[0].provider);
        if (data.errorProvider !== undefined) setErrorProvider(data.errorProvider || "");
      } catch (err) {
        console.error("[SSE CLIENT] parse error:", err);
      }
    };

    return () => es.close();
  }, []);

  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
        <h3 className="text-[13.5px] font-semibold">Provider topology</h3>
      </div>
      <div className="p-[18px]">
        <ProviderTopology
          providers={providers}
          activeRequests={activeRequests}
          lastProvider={lastProvider}
          errorProvider={errorProvider}
        />
      </div>
    </Card>
  );
}
