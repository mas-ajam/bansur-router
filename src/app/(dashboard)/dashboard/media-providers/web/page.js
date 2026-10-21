"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Button, Input } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { getProvidersByKind } from "@/shared/constants/providers";

/* Web Fetch & Search — test panel (audit W-01..W-03).
   Execution: the gateway's own endpoints are dashboard-callable —
   POST /api/v1/web/fetch and POST /api/v1/search (provider IS the model).
   The panel picks a target the same way the gateway would be called by a
   tool: a web combo of the matching kind if one exists, else the first
   connected (or no-auth) provider of that kind, and authenticates with the
   first active dashboard API key from /api/keys when one exists.
   If no target exists, the buttons report Unavailable instead of faking
   results. The previous provider/combo management sections moved off this
   route; management stays reachable via the [kind]/[id] routes. */

function Kv({ k, children }) {
  return (
    <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
      <span className="text-text-muted">{k}</span>
      <span className="font-mono text-[12.5px] text-right">{children}</span>
    </div>
  );
}

export default function WebTestPanelPage() {
  const notify = useNotificationStore();
  const [tab, setTab] = useState("fetch");

  const [targets, setTargets] = useState({ webFetch: null, webSearch: null });
  const [apiKey, setApiKey] = useState(null);

  const [url, setUrl] = useState("");
  const [fetchStatus, setFetchStatus] = useState("Not run yet");
  const [fetchExtracted, setFetchExtracted] = useState("—");
  const [fetchResult, setFetchResult] = useState("Fetched page content, converted to clean markdown, will appear here.");
  const [fetching, setFetching] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searchNote, setSearchNote] = useState("Results will appear here.");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/providers", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/combos", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/keys", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([providersData, combosData, keysData]) => {
      const connections = providersData?.connections || [];
      const combos = combosData?.combos || [];
      const pickTarget = (kind) => {
        const combo = combos.find((c) => c.kind === kind && Array.isArray(c.models) && c.models.length > 0);
        if (combo) return combo.name;
        const providers = getProvidersByKind(kind);
        const connected = providers.find((p) =>
          connections.some((c) => c.provider === p.id && c.isActive !== false)
        );
        if (connected) return connected.id;
        const noAuth = providers.find((p) => p.noAuth);
        return noAuth ? noAuth.id : null;
      };
      setTargets({ webFetch: pickTarget("webFetch"), webSearch: pickTarget("webSearch") });
      const keys = keysData?.keys || [];
      const active = keys.find((k) => k.isActive !== false && k.key);
      setApiKey(active ? active.key : null);
    });
  }, []);

  const callGateway = async (path, body) => {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const handleFetch = async () => {
    const target = targets.webFetch;
    if (!target) {
      setFetchStatus("Unavailable");
      notify.error("No web fetch provider or combo is connected in this build");
      return;
    }
    if (!url.trim()) {
      notify.error("Enter a URL to fetch");
      return;
    }
    setFetching(true);
    setFetchStatus("Fetching…");
    try {
      const { res, data } = await callGateway("/api/v1/web/fetch", { model: target, url: url.trim() });
      if (res.ok) {
        const text = data?.content?.text || "";
        setFetchStatus(`OK · ${res.status}`);
        setFetchExtracted(`${(data?.content?.length ?? text.length).toLocaleString()} chars of markdown`);
        setFetchResult(text || "The provider returned no extractable content.");
      } else {
        setFetchStatus(`Error · ${res.status}`);
        setFetchExtracted("—");
        setFetchResult(data?.error || `Fetch failed (${res.status})`);
      }
    } catch {
      setFetchStatus("Error");
      setFetchResult("Network error while calling the gateway.");
    } finally {
      setFetching(false);
    }
  };

  const handleSearch = async () => {
    const target = targets.webSearch;
    if (!target) {
      setResults(null);
      setSearchNote("Unavailable — no web search provider or combo is connected in this build.");
      notify.error("No web search provider or combo is connected in this build");
      return;
    }
    if (!query.trim()) {
      notify.error("Enter a search query");
      return;
    }
    setSearching(true);
    setResults(null);
    setSearchNote("Searching…");
    try {
      const { res, data } = await callGateway("/api/v1/search", { model: target, query: query.trim() });
      if (res.ok && Array.isArray(data?.results)) {
        setResults(data.results);
        setSearchNote(data.results.length === 0 ? "No results returned." : "");
      } else {
        setResults(null);
        setSearchNote(data?.error || `Search failed (${res.status})`);
      }
    } catch {
      setResults(null);
      setSearchNote("Network error while calling the gateway.");
    } finally {
      setSearching(false);
    }
  };

  const pillClass = (active) =>
    `border rounded-full px-[13px] py-[5px] text-[12.5px] font-medium transition-colors ${
      active ? "bg-brand-500 border-brand-500 text-on-brand" : "border-border-strong bg-surface text-text-main"
    }`;

  return (
    <div>
      {/* Back link + head */}
      <div className="mb-5">
        <Link
          href="/dashboard/media-providers"
          className="inline-flex items-center gap-1.5 h-[30px] px-2.5 -ml-2.5 rounded-md text-[12.5px] font-medium text-text-main hover:bg-[#eef0f1] dark:hover:bg-surface-2 transition-colors mb-3.5"
        >
          ← Media Providers
        </Link>
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Web Fetch &amp; Search</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">The web tool the router offers to connected clients. Test a fetch or a search exactly as a tool would call it.</p>
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1.5 mb-3.5">
        <button type="button" className={pillClass(tab === "fetch")} onClick={() => setTab("fetch")}>
          Fetch URL
        </button>
        <button type="button" className={pillClass(tab === "search")} onClick={() => setTab("search")}>
          Search web
        </button>
      </div>

      {tab === "fetch" ? (
        <Card>
          <label className="block text-[12.5px] font-semibold mb-1.5">URL to fetch</label>
          <div className="flex gap-2.5">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              inputClassName="font-mono"
              className="grow"
              onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
            />
            <Button variant="primary" onClick={handleFetch} loading={fetching}>
              Fetch
            </Button>
          </div>
          <div className="h-px bg-border my-[18px]" />
          <Kv k="Status">{fetchStatus}</Kv>
          <Kv k="Extracted">{fetchExtracted}</Kv>
          <div className="bg-surface-2 text-text-main border border-border rounded-brand px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] overflow-x-auto whitespace-pre-wrap mt-3.5">
            {fetchResult}
          </div>
        </Card>
      ) : (
        <Card>
          <label className="block text-[12.5px] font-semibold mb-1.5">Search query</label>
          <div className="flex gap-2.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="OpenAI-compatible local AI gateway"
              className="grow"
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <Button variant="primary" onClick={handleSearch} loading={searching}>
              Search
            </Button>
          </div>
          <div className="h-px bg-border my-[18px]" />
          {results && results.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {results.map((r, i) => (
                <div key={`${r.url || r.title || "result"}-${i}`}>
                  <div className="font-semibold text-[13.5px]">{r.title || r.url}</div>
                  {r.url && <div className="font-mono text-[12px] text-text-muted break-all">{r.url}</div>}
                  {r.snippet && <p className="text-[13px] text-text-main mt-0.5">{r.snippet}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">{searchNote}</p>
          )}
        </Card>
      )}
    </div>
  );
}
