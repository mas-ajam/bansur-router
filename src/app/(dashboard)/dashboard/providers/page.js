"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardSkeleton,
  Button,
  Input,
} from "@/shared/components";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import {
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
  ANTHROPIC_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import Link from "next/link";
import { getErrorCode } from "@/shared/utils";
import { useNotificationStore } from "@/store/notificationStore";
import AddCompatibleModal from "./components/AddCompatibleModal";

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  )
    return "AUTH";
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400)
    return String(numericCode);

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (
    msg.includes("runtime") ||
    msg.includes("not runnable") ||
    msg.includes("not installed")
  )
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

/* P-05: two-letter glyph for the prov-ico tile — the registry entry's
   textIcon when present, otherwise the initials of the provider name. */
function getProviderGlyph(provider, providerId) {
  if (provider?.textIcon) return provider.textIcon;
  const words = (provider?.name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (providerId || "??").slice(0, 2).toUpperCase();
}

/* P-07: status line as plain 12px muted text (no Badge). Plan and
   remaining % come from the last quota snapshot recorded server-side
   (/api/usage/[connectionId] → quotaSnapshot on each connection);
   absent when no snapshot exists — never fabricated. */
function getStatusText(stats, kind, isNoAuth) {
  if (isNoAuth) return "Ready";
  const { connected, error, errorCode, total, allDisabled, plan, remainingPct } = stats;
  if (!total) return kind === "apikey" ? "No key saved" : "Not connected";
  if (allDisabled) return "Disabled";
  const parts = [];
  if (connected > 0) {
    parts.push(
      kind === "apikey" || kind === "self"
        ? `${total} key${total === 1 ? "" : "s"} saved`
        : `${connected} account${connected === 1 ? "" : "s"} connected`,
    );
  }
  if (error > 0) {
    parts.push(
      `${error} error${error === 1 ? "" : "s"}${errorCode ? ` (${errorCode})` : ""}`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      kind === "apikey" || kind === "self"
        ? `${total} key${total === 1 ? "" : "s"} saved`
        : `${total} account${total === 1 ? "" : "s"} connected`,
    );
  }
  if (plan) parts.push(plan);
  if (typeof remainingPct === "number") parts.push(`${remainingPct}% left`);
  return parts.join(" · ");
}

const PILL_TABS = [
  { value: "all", label: "All" },
  { value: "oauth", label: "OAuth" },
  { value: "free", label: "Free" },
  { value: "apikey", label: "API Key" },
  { value: "self", label: "Self-hosted" },
];

const pillTabClass = (active) =>
  `border rounded-full px-[13px] py-[5px] text-[12.5px] font-medium transition-colors ${
    active
      ? "bg-brand-500 border-brand-500 text-white"
      : "border-border-strong bg-surface text-text-main hover:bg-surface-2"
  }`;

/* Button-primary-sm look on a Link (Manage / Connect / Add key / Add endpoint). */
const primaryLinkClass =
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap border font-medium transition-colors bg-brand-500 border-brand-500 hover:bg-brand-600 hover:border-brand-600 text-on-brand px-2.5 py-1 text-[12.5px] rounded-md";

export default function ProvidersPage() {
  const [connections, setConnections] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] =
    useState(false);
  const [testingMode, setTestingMode] = useState(null);
  // P-01: page-local toolbar state (pill-tabs + search), replacing the
  // status Select and the topbar-search coupling.
  const [activeTab, setActiveTab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const notify = useNotificationStore();

  const matchSearch = (name) => {
    if (!searchText.trim()) return true;
    if (!name) return false;
    return name.toLowerCase().includes(searchText.trim().toLowerCase());
  };

  const sortByPriority = (entries, authType) =>
    [...entries].sort(([ka, a], [kb, b]) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      const sa = getProviderStats(ka, authType);
      const sb = getProviderStats(kb, authType);
      const ca = sa.connected > 0 ? 1 : 0;
      const cb = sb.connected > 0 ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return (a.name || "").localeCompare(b.name || "");
    });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connectionsRes, nodesRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        if (connectionsRes.ok)
          setConnections(connectionsData.connections || []);
        if (nodesRes.ok) setProviderNodes(nodesData.nodes || []);
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProviderStats = (providerId, authType) => {
    const authTypes = Array.isArray(authType) ? authType : [authType];
    const providerConnections = connections.filter(
      (c) => c.provider === providerId && authTypes.includes(c.authType),
    );

    const getEffectiveStatus = (conn) => {
      const isCooldown = Object.entries(conn).some(
        ([k, v]) =>
          k.startsWith("modelLock_") && v && new Date(v).getTime() > Date.now(),
      );
      return conn.testStatus === "unavailable" && !isCooldown
        ? "active"
        : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return (
        status === "error" || status === "expired" || status === "unavailable"
      );
    });

    const error = errorConns.length;
    const total = providerConnections.length;
    const allDisabled =
      total > 0 && providerConnections.every((c) => c.isActive === false);

    const latestError = errorConns.sort(
      (a, b) => new Date(b.lastErrorAt || 0) - new Date(a.lastErrorAt || 0),
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt
      ? latestError.lastErrorAt
      : null;

    // P-07: quota snapshot enrichment — plan from any snapshotted
    // connection; remaining % is the minimum across them (binding window).
    const snapshots = providerConnections.map((c) => c.quotaSnapshot).filter(Boolean);
    const plan = snapshots.find((s) => s.plan)?.plan || null;
    const remainingValues = snapshots
      .map((s) => s.remainingPct)
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    const remainingPct = remainingValues.length ? Math.min(...remainingValues) : null;

    return { connected, error, total, errorCode, errorTime, allDisabled, plan, remainingPct };
  };

  // Per-provider test (P-08 `Test` button): the existing test-batch
  // endpoint with a single provider. P-13: results surface as a toast —
  // the Test Results modal is removed.
  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
      });
      const data = await res.json();
      if (data.summary) {
        const { passed, failed, total } = data.summary;
        if (total === 0) notify.info("No active connections to test");
        else if (failed === 0) notify.success(`All ${total} tests passed`);
        else notify.warning(`${passed}/${total} passed, ${failed} failed`);
      } else {
        notify.error("Provider test failed");
      }
    } catch (error) {
      notify.error("Provider test failed");
    } finally {
      setTestingMode(null);
    }
  };

  const compatibleProviders = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || "OpenAI Compatible",
      color: "#5d666e",
      textIcon: "OC",
      apiType: node.apiType,
    }))
    .filter((p) => matchSearch(p.name));

  const anthropicCompatibleProviders = providerNodes
    .filter((node) => node.type === "anthropic-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || "Anthropic Compatible",
      color: "#101418",
      textIcon: "AC",
    }))
    .filter((p) => matchSearch(p.name));

  // Dual-auth providers (oauth + apikey) store API keys as authType "apikey"
  // (and sometimes "api_key"). Card stats must count both so totals match detail.
  // kiro has no authModes in registry but accepts both (headless uses "api_key").
  const dualAuthTypes = (info, key) => {
    if (key === "kiro") return ["oauth", "apikey", "api_key"];
    const modes = info?.authModes;
    // Free-tier and API-key providers default to supporting apikey even when the
    // registry entry omits authModes (e.g. cloudflare-ai, byteplus, ollama,
    // vertex) — otherwise their apikey connections are invisible on the grid card.
    if (!Array.isArray(modes)) {
      return key in FREE_TIER_PROVIDERS || key in APIKEY_PROVIDERS
        ? ["oauth", "apikey", "api_key"]
        : "oauth";
    }
    if (!modes.includes("apikey")) return "oauth";
    return ["oauth", "apikey", "api_key"];
  };

  const oauthEntries = sortByPriority(
    Object.entries(OAUTH_PROVIDERS).filter(
      ([key, info]) => !info.hidden && matchSearch(info.name),
    ),
    "oauth",
  );
  const freeEntries = Object.entries(FREE_PROVIDERS)
    .filter(([key, info]) => !info.hidden && matchSearch(info.name))
    .sort(([, a], [, b]) => (b.noAuth ? 1 : 0) - (a.noAuth ? 1 : 0));
  // Free Tier cards may be oauth-only (e.g. kimchi) or dual-auth, so count via
  // dualAuthTypes per provider instead of a fixed "apikey" — otherwise oauth
  // connections are invisible here (mismatch with the detail page).
  const freeTierEntries = Object.entries(FREE_TIER_PROVIDERS)
    .filter(
      ([key, info]) =>
        !info.hidden &&
        matchSearch(info.name) &&
        (info.serviceKinds ?? ["llm"]).includes("llm"),
    )
    .sort(([ka, a], [kb, b]) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      const noAuthDiff = (b.noAuth ? 1 : 0) - (a.noAuth ? 1 : 0);
      if (noAuthDiff !== 0) return noAuthDiff;
      const ca = getProviderStats(ka, dualAuthTypes(a, ka)).connected > 0 ? 0 : 1;
      const cb = getProviderStats(kb, dualAuthTypes(b, kb)).connected > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return (a.name || "").localeCompare(b.name || "");
    });
  // API Key: connected providers first, then alphabetical by name.
  // P-09: all cards are shown — no slice-20 / "Show all" truncation.
  const apikeyEntries = Object.entries(APIKEY_PROVIDERS)
    .filter(
      ([key, info]) =>
        !info.hidden &&
        (info.serviceKinds ?? ["llm"]).includes("llm") &&
        matchSearch(info.name),
    )
    .sort(([ka, a], [kb, b]) => {
      const ca = getProviderStats(ka, "apikey").total > 0 ? 0 : 1;
      const cb = getProviderStats(kb, "apikey").total > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return (a.name || "").localeCompare(b.name || "");
    });

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const selfCards = [
    ...compatibleProviders.map((info) => ({ key: info.id, info, kind: "self" })),
    ...anthropicCompatibleProviders.map((info) => ({
      key: info.id,
      info,
      kind: "self",
    })),
  ];

  // P-02/P-03: group order OAuth → Free tier → API key → Self-hosted last,
  // with the artifact's exact titles. P-10: groups with no visible cards
  // are hidden entirely (no empty-state art).
  const groups = [
    {
      cat: "oauth",
      title: "OAuth — subscription accounts",
      cards: oauthEntries.map(([key, info]) => {
        const authTypes = dualAuthTypes(info, key);
        return {
          key,
          info,
          stats: getProviderStats(key, authTypes),
          kind: "oauth",
          authLabel: "OAuth",
        };
      }),
    },
    {
      cat: "free",
      title: "Free tier",
      cards: [
        ...freeEntries.map(([key, info]) => {
          const authTypes = dualAuthTypes(info, key);
          return {
            key,
            info,
            stats: getProviderStats(key, authTypes),
            kind: "free",
            authLabel: "Free",
          };
        }),
        ...freeTierEntries.map(([key, info]) => {
          const authTypes = dualAuthTypes(info, key);
          return {
            key,
            info,
            stats: getProviderStats(key, authTypes),
            kind: "free",
            authLabel: "Free",
          };
        }),
      ],
    },
    {
      cat: "apikey",
      title: "API key",
      cards: apikeyEntries.map(([key, info]) => ({
        key,
        info,
        stats: getProviderStats(key, "apikey"),
        kind: "apikey",
        authLabel: "API Key",
      })),
    },
    {
      cat: "self",
      title: "Self-hosted",
      cards: selfCards.map(({ key, info }) => ({
        key,
        info,
        stats: getProviderStats(info.id, "apikey"),
        kind: "self",
        authLabel: "Self-hosted",
        descriptor: info.id.startsWith(ANTHROPIC_COMPATIBLE_PREFIX)
          ? "Anthropic Compatible"
          : "OpenAI Compatible",
      })),
    },
  ];

  const visibleGroups = groups.filter((group) => {
    if (activeTab !== "all" && activeTab !== group.cat) return false;
    if (group.cards.length > 0) return true;
    // Keep the Self-hosted group reachable with no search active so the
    // custom-endpoint create flow (AddCompatibleModal) always has a home.
    return group.cat === "self" && !searchText.trim();
  });

  return (
    <div className="flex min-w-0 flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Providers</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Connect subscription accounts, free tiers, and API keys. Bansur Router rotates across accounts and falls back down the tiers automatically.</p>
      </div>

      {/* P-01: spec toolbar — pill-tabs + page-local search */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
        <div className="flex flex-wrap gap-1.5">
          {PILL_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={pillTabClass(activeTab === tab.value)}
              aria-pressed={activeTab === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Input
          placeholder="Search providers"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full max-w-[240px]"
          aria-label="Search providers"
        />
      </div>

      {visibleGroups.map((group, groupIndex) => (
        <div key={group.cat}>
          <div
            className={`flex flex-wrap items-center gap-2.5 ${
              groupIndex === 0 ? "mt-[18px]" : "mt-6"
            } mb-2.5`}
          >
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
              {group.title}
            </h3>
            {group.cat === "self" && (
              <>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAddAnthropicCompatibleModal(true)}
                >
                  Add Anthropic Compatible
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAddCompatibleModal(true)}
                >
                  Add OpenAI Compatible
                </Button>
              </>
            )}
          </div>
          {group.cards.length > 0 ? (
            <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
              {group.cards.map((card) => (
                <ProviderCard
                  key={card.key}
                  providerId={card.key}
                  provider={card.info}
                  stats={card.stats}
                  kind={card.kind}
                  authLabel={card.authLabel}
                  descriptor={card.descriptor || card.info.descriptor}
                  onTest={(id) => handleBatchTest("provider", id)}
                  testing={testingMode === card.key}
                />
              ))}
            </div>
          ) : (
            /* Self-hosted placeholder (the artifact's single self-hosted
               card) — its Add endpoint button opens the existing
               custom-create flow. */
            <div className="grid gap-3.5 grid-cols-1 min-[561px]:grid-cols-2 min-[1081px]:grid-cols-3">
              <Card padding="none">
                <div className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
                      LO
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-[1.25]">Local / OpenAI-compatible</h3>
                      <p className="text-xs text-text-muted">Custom base URL</p>
                    </div>
                    <span className="inline-block w-2 h-2 rounded-full shrink-0 mt-1 border-[1.5px] border-[#a7afb6]" />
                  </div>
                  <p className="text-xs text-text-muted">No custom endpoint added</p>
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setShowAddCompatibleModal(true)}
                    >
                      Add endpoint
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      ))}

      <AddCompatibleModal
        variant="openai"
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddCompatibleModal
        variant="anthropic"
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />
    </div>
  );
}

function ProviderCard({
  providerId,
  provider,
  stats,
  kind,
  authLabel,
  descriptor,
  onTest,
  testing,
}) {
  const { connected, error, total } = stats;
  const isNoAuth = !!provider.noAuth;
  const hasConnection = total > 0 || isNoAuth;

  const dotClass =
    error > 0
      ? "bg-white border-[2.5px] border-brand-500"
      : connected > 0 || isNoAuth
        ? "bg-brand-500"
        : "border-[1.5px] border-[#a7afb6]";

  // P-06: meta line is `{descriptor} · {auth}`. The descriptor now comes
  // from the registry entry's display.descriptor (wired by the caller);
  // the auth label renders alone when a provider has none.
  const meta = descriptor ? `${descriptor} · ${authLabel}` : authLabel;

  const connectLabel =
    kind === "apikey"
      ? "Add key"
      : kind === "self"
        ? "Add endpoint"
        : "Connect";

  return (
    <Card padding="none" className="h-full">
      <div className="flex h-full min-w-0 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {/* P-05: two-letter glyph tile, no brand PNGs */}
          <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
            {getProviderGlyph(provider, providerId)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-semibold text-sm leading-[1.25]">{provider.name}</h3>
            <p className="truncate text-xs text-text-muted">{meta}</p>
          </div>
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${dotClass}`} />
        </div>
        {/* P-07: plain status text */}
        <p className="text-xs text-text-muted">
          {getStatusText(stats, kind, isNoAuth)}
        </p>
        {/* P-08: footer buttons; the card itself is not a link and there
            is no hover-reveal Toggle (P-11: no disabled opacity either). */}
        <div className="mt-auto flex items-center gap-2">
          {hasConnection ? (
            <>
              <Link href={`/dashboard/providers/${providerId}`} className={primaryLinkClass}>
                Manage
              </Link>
              {total > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onTest(providerId)}
                  disabled={testing}
                >
                  {testing ? "Testing..." : "Test"}
                </Button>
              )}
            </>
          ) : (
            <Link href={`/dashboard/providers/${providerId}`} className={primaryLinkClass}>
              {connectLabel}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    noAuth: PropTypes.bool,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    total: PropTypes.number,
    allDisabled: PropTypes.bool,
    plan: PropTypes.string,
    remainingPct: PropTypes.number,
  }).isRequired,
  kind: PropTypes.string.isRequired,
  authLabel: PropTypes.string.isRequired,
  descriptor: PropTypes.string,
  onTest: PropTypes.func.isRequired,
  testing: PropTypes.bool,
};
