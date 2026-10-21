"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/shared/components";
import { getProvidersByKind } from "@/shared/constants/providers";
import { EmbeddingExampleCard } from "./[kind]/[id]/components/EmbeddingExampleCard";
import { TtsExampleCard } from "./[kind]/[id]/components/TtsExampleCard";
import { SttExampleCard } from "./[kind]/[id]/components/SttExampleCard";
import { GenericExampleCard } from "./[kind]/[id]/components/GenericExampleCard";
import { KIND_EXAMPLE_CONFIG } from "./[kind]/[id]/components/exampleShared";

/* Media Providers — single page (audit M-01..M-04).
   Data flow reused from the [kind] pages: providers from the registry
   constants (getProvidersByKind), connection state from /api/providers,
   custom embedding nodes from /api/provider-nodes.
   Groups beyond the artifact's Image / Video / Web (Embedding, TTS, STT,
   Image to Text, Music, System One) are a flagged carry-over: dropping them
   would orphan real provider categories. */

const KIND_DESCRIPTOR = {
  image: "Image generation",
  video: "Video generation",
  embedding: "Embeddings",
  tts: "Text to speech",
  stt: "Speech to text",
  imageToText: "Image understanding",
  music: "Music generation",
  systemone: "System One",
};

function getEffectiveStatus(conn) {
  const isCooldown = Object.entries(conn).some(
    ([k, v]) => k.startsWith("modelLock_") && v && new Date(v).getTime() > Date.now()
  );
  return conn.testStatus === "unavailable" && !isCooldown ? "active" : conn.testStatus;
}

function authLabel(provider) {
  if (provider.noAuth) return "No key needed";
  const modes = provider.authModes || [];
  if (modes.includes("oauth") || provider.authType === "oauth") return "OAuth";
  if (modes.includes("apikey") || provider.authType === "apikey") return "API key";
  if (provider.authType) return provider.authType;
  return "API key";
}

function letterTile(provider) {
  if (provider.textIcon) return provider.textIcon.slice(0, 2).toUpperCase();
  return (provider.name || provider.id || "?").slice(0, 2).toUpperCase();
}

function providerState(provider, connections) {
  const conns = connections.filter((c) => c.provider === provider.id);
  const connected = conns.filter((c) => { const s = getEffectiveStatus(c); return s === "active" || s === "success"; }).length;
  const errors = conns.filter((c) => { const s = getEffectiveStatus(c); return s === "error" || s === "expired" || s === "unavailable"; }).length;
  const total = conns.length;
  const allDisabled = total > 0 && conns.every((c) => c.isActive === false);

  if (provider.noAuth) {
    return { dot: "on", status: "Ready · no key needed", connected: true };
  }
  if (allDisabled) {
    return { dot: "off", status: "Disabled", connected: false };
  }
  if (connected > 0) {
    return {
      dot: errors > 0 ? "warn" : "on",
      status: `${connected} account${connected === 1 ? "" : "s"} connected`,
      connected: true,
    };
  }
  if (errors > 0) {
    return { dot: "warn", status: `${errors} connection${errors === 1 ? "" : "s"} in error`, connected: false };
  }
  if (total > 0) {
    return { dot: "off", status: `${total} added · not tested yet`, connected: true };
  }
  return { dot: "off", status: "No key saved", connected: false };
}

function Dot({ state }) {
  if (state === "on") return <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-brand-500" />;
  if (state === "warn") return <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-surface border-[2.5px] border-brand-500" />;
  return <span className="inline-block w-2 h-2 rounded-full shrink-0 border-[1.5px] border-[#a7afb6]" />;
}

function MediaCard({ provider, kind, connections }) {
  const state = providerState(provider, connections);
  const href = `/dashboard/media-providers/${kind}/${provider.id}`;
  return (
    <Card padding="none" className="p-4 flex flex-col gap-3 h-full">
      <div className="flex items-start gap-3">
        <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
          {letterTile(provider)}
        </div>
        <div className="grow min-w-0">
          <div className="font-semibold text-sm leading-[1.25]">{provider.name}</div>
          <div className="text-xs text-text-muted">{KIND_DESCRIPTOR[kind]} · {authLabel(provider)}</div>
        </div>
        <Dot state={state.dot} />
      </div>
      <div className="text-xs text-text-muted">{state.status}</div>
      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-[7px] font-medium whitespace-nowrap border px-2.5 py-1 text-[12.5px] rounded-md bg-surface border-border-strong text-text-main hover:bg-surface-2 hover:border-[#b9c0c6] dark:hover:border-[#4b5158] transition-colors"
        >
          {state.connected ? "Manage" : "Add key"}
        </Link>
      </div>
    </Card>
  );
}

/* Examples — restored (Option 2 batch 5, M-01): the pre-removal per-kind
   example/demo cards (Embedding / TTS / STT / Generic) also live on each
   provider's detail page; this section surfaces the same live cards on
   the single spec page, below the provider groups, with a kind +
   provider picker. The cards are the original components, unchanged. */
const EXAMPLE_KINDS = ["image", "video", "embedding", "tts", "stt", "imageToText", "music", "systemone"];

function MediaExamplesSection({ customEmbeddingProviders }) {
  const [kind, setKind] = useState("image");
  const providers = kind === "embedding"
    ? [...getProvidersByKind("embedding"), ...customEmbeddingProviders]
    : getProvidersByKind(kind);
  const [providerId, setProviderId] = useState("");
  const effectiveProviderId = providers.some((p) => p.id === providerId) ? providerId : providers[0]?.id || "";

  return (
    <div className="mt-8">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-subtle mb-2.5">
        Examples
      </h3>
      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value); setProviderId(""); }}
          aria-label="Example kind"
          className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] text-text-main"
        >
          {EXAMPLE_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_DESCRIPTOR[k] || k}</option>
          ))}
        </select>
        <select
          value={effectiveProviderId}
          onChange={(e) => setProviderId(e.target.value)}
          aria-label="Example provider"
          className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] text-text-main"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {effectiveProviderId && (
          <Link
            href={`/dashboard/media-providers/${kind}/${effectiveProviderId}`}
            className="text-[12.5px] font-medium text-text-muted hover:text-text-main hover:underline"
          >
            Open provider →
          </Link>
        )}
      </div>
      {effectiveProviderId ? (
        <div key={`${kind}-${effectiveProviderId}`}>
          {kind === "embedding" && (
            <EmbeddingExampleCard providerId={effectiveProviderId} customAlias={customEmbeddingProviders.find((p) => p.id === effectiveProviderId) ? effectiveProviderId : undefined} />
          )}
          {kind === "tts" && <TtsExampleCard providerId={effectiveProviderId} />}
          {kind === "stt" && <SttExampleCard providerId={effectiveProviderId} />}
          {kind !== "embedding" && kind !== "tts" && kind !== "stt" && KIND_EXAMPLE_CONFIG[kind] && (
            <GenericExampleCard providerId={effectiveProviderId} kind={kind} />
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted">No providers for this kind yet.</p>
      )}
    </div>
  );
}

export default function MediaProvidersPage() {
  const [connections, setConnections] = useState([]);
  const [customNodes, setCustomNodes] = useState([]);

  useEffect(() => {
    fetch("/api/providers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConnections(d?.connections || []))
      .catch(() => {});
    fetch("/api/provider-nodes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCustomNodes((d?.nodes || []).filter((n) => n.type === "custom-embedding")))
      .catch(() => {});
  }, []);

  const customEmbeddingProviders = customNodes.map((n) => ({
    id: n.id,
    name: n.name || "Custom Embedding",
    textIcon: "CE",
  }));

  let groupIndex = 0;
  const renderGroup = (kind, heading, providers) => {
    if (providers.length === 0) return null;
    const first = groupIndex === 0;
    groupIndex += 1;
    return (
      <div key={kind}>
        <h3 className={`text-[13px] font-semibold uppercase tracking-[0.08em] text-text-subtle ${first ? "mt-[6px] mb-2.5" : "mt-6 mb-2.5"}`}>
          {heading}
        </h3>
        <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
          {providers.map((provider) => (
            <MediaCard key={provider.id} provider={provider} kind={kind} connections={connections} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Media Providers</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Non-chat providers the router exposes alongside models: image, video, and web capabilities.</p>
      </div>

      {renderGroup("image", "Image", getProvidersByKind("image"))}
      {renderGroup("video", "Video", getProvidersByKind("video"))}

      {/* Web group — single built-in card (M-04) */}
      <div>
        <h3 className={`text-[13px] font-semibold uppercase tracking-[0.08em] text-text-subtle ${groupIndex === 0 ? "mt-[6px] mb-2.5" : "mt-6 mb-2.5"}`}>
          Web
        </h3>
        <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
          <Card padding="none" className="p-4 flex flex-col gap-3 h-full">
            <div className="flex items-start gap-3">
              <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
                WF
              </div>
              <div className="grow min-w-0">
                <div className="font-semibold text-sm leading-[1.25]">Web Fetch &amp; Search</div>
                <div className="text-xs text-text-muted">Fetch URLs · web search tool</div>
              </div>
              <Dot state="on" />
            </div>
            <div className="text-xs text-text-muted">Built in · no key needed</div>
            <div className="flex items-center gap-2 mt-auto">
              <Link
                href="/dashboard/media-providers/web"
                className="inline-flex items-center justify-center gap-[7px] font-medium whitespace-nowrap border px-2.5 py-1 text-[12.5px] rounded-md bg-brand-500 border-brand-500 text-on-brand hover:bg-brand-600 hover:border-brand-600 transition-colors"
              >
                Open test panel
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Carry-over groups (not in the artifact; real provider categories) */}
      {renderGroup("embedding", "Embedding", [...getProvidersByKind("embedding"), ...customEmbeddingProviders])}
      {renderGroup("tts", "Text To Speech", getProvidersByKind("tts"))}
      {renderGroup("stt", "Speech To Text", getProvidersByKind("stt"))}
      {renderGroup("imageToText", "Image to Text", getProvidersByKind("imageToText"))}
      {renderGroup("music", "Music", getProvidersByKind("music"))}
      {renderGroup("systemone", "System One", getProvidersByKind("systemone"))}

      {/* Restored example/demo cards per kind (batch 5, M-01) */}
      <MediaExamplesSection customEmbeddingProviders={customEmbeddingProviders} />
    </div>
  );
}
