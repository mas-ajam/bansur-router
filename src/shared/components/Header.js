"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import PropTypes from "prop-types";
import HeaderMenu from "@/shared/components/HeaderMenu";
import HeaderGridMenu from "@/shared/components/HeaderGridMenu";
import HeaderLanguage from "@/shared/components/HeaderLanguage";
import HeaderSearch from "@/shared/components/HeaderSearch";
import DonateModal from "@/shared/components/DonateModal";
import ThemeToggle from "@/shared/components/ThemeToggle";
import SpecIcon from "@/shared/components/SpecIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { translate } from "@/i18n/runtime";

/* Topbar titles follow the artifact screen inventory exactly (audit T-01). */
const getPageTitle = (pathname) => {
  if (!pathname) return "";

  // Media provider detail: /dashboard/media-providers/[kind]/[id]
  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const providerId = mediaDetailMatch[2];
    return AI_PROVIDERS[providerId]?.name || providerId;
  }

  // Web Fetch & Search test panel
  if (pathname.includes("/media-providers/web")) return "Web Fetch & Search";

  // Media provider kind pages
  if (pathname.includes("/media-providers")) return "Media Providers";

  // Provider detail page: /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerInfo =
      OAUTH_PROVIDERS[providerMatch[1]] || APIKEY_PROVIDERS[providerMatch[1]];
    if (providerInfo) return providerInfo.name;
  }

  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.includes("/endpoint")) return "Endpoint & Key";
  if (pathname.includes("/providers")) return "Providers";
  if (pathname.includes("/combos")) return "Combo & Vision Adapter";
  if (pathname.includes("/usage")) return "Usage";
  if (pathname.includes("/quota")) return "Quota Tracker";
  if (pathname.includes("/console-log")) return "Console Log";
  if (pathname.includes("/token-saver")) return "Token Saver";
  if (pathname.includes("/pxpipe")) return "PXPIPE";
  if (pathname.includes("/translator")) return "Translator";
  if (pathname.includes("/cli-tools")) return "CLI Tools";
  if (pathname.includes("/basic-chat")) return "Basic Chat";
  if (pathname.includes("/skills")) return "Skills";
  if (pathname.includes("/proxy-pools")) return "Proxy Pools";
  if (pathname.includes("/mitm")) return "MITM";
  if (pathname.includes("/profile")) return "Profile";
  if (pathname.includes("/settings")) return "Settings";
  if (pathname.includes("/auth-files")) return "Auth Files";
  return "";
};

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("");
  const [loginMethod, setLoginMethod] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);

  const title = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setDisplayName(data?.displayName || data?.samlName || data?.samlEmail || data?.oidcName || data?.oidcEmail || "");
          setLoginMethod(data?.loginMethod || "");
        }
      } catch {
        if (!cancelled) {
          setDisplayName("");
          setLoginMethod("");
        }
      }
    }

    loadAuthStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.assign("/login");
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <header className="shrink-0 h-[58px] flex items-center gap-3.5 px-[14px] min-[821px]:px-[26px] border-b border-border bg-surface/[0.88] backdrop-blur-[8px] z-20">
      {/* Mobile menu button — artifact .icon-btn, shown ≤820px */}
      {showMenuButton && (
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          className="min-[821px]:hidden inline-flex items-center justify-center size-[30px] shrink-0 rounded-md border border-border-strong bg-surface text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
        >
          <SpecIcon size={17} strokeWidth={2}>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </SpecIcon>
        </button>
      )}

      {/* Screen title */}
      <div className="min-w-0">
        {title ? (
          <h1 className="text-base font-semibold text-text-main truncate whitespace-nowrap">
            {translate(title)}
          </h1>
        ) : null}
      </div>

      <div className="flex-1" />

      {/* Right cluster — endpoint chip + avatar (spec) + Option 2 restoration extras:
          SSO identity chip (conditional), HeaderSearch (conditional), Donate,
          theme toggle, language switcher, grid menu. Spec items keep their order;
          extras are additions only. */}
      <div className="flex items-center gap-2 min-[821px]:gap-3.5 shrink-0">
        <EndpointChip />
        {displayName && (loginMethod === "OIDC" || loginMethod === "SAML") && (
          <div
            className="hidden lg:flex items-center max-w-[220px] px-3 py-1.5 rounded-full border border-border bg-surface-2 text-xs text-text-muted truncate"
            title={displayName}
          >
            <span className="material-symbols-outlined text-[14px] mr-1.5 text-text-main">person</span>
            <span className="truncate">{displayName}</span>
            <span className="ml-2 shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-main">
              {loginMethod}
            </span>
          </div>
        )}
        <HeaderSearch />
        <button
          onClick={() => setDonateOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border-strong bg-surface-2 text-text-main hover:bg-surface-3 transition-colors text-sm font-medium"
          aria-label="Donate"
        >
          <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
          <span className="hidden md:inline">Donate</span>
        </button>
        <ThemeToggle />
        <HeaderLanguage />
        <HeaderGridMenu onLogout={handleLogout} />
        <HeaderMenu onLogout={handleLogout} displayName={displayName} />
      </div>
      <DonateModal isOpen={donateOpen} onClose={() => setDonateOpen(false)} />
    </header>
  );
}

function EndpointChip() {
  const [origin, setOrigin] = useState("");
  const { copied, copy } = useCopyToClipboard(1600);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  if (!origin) return null;
  const url = `${origin}/v1`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border-strong bg-surface py-[5px] pr-1.5 pl-3 max-[560px]:pl-[9px]">
      <span className="size-2 rounded-full bg-text-main shrink-0" aria-hidden="true" />
      <span className="max-[820px]:hidden font-mono text-xs text-text-muted whitespace-nowrap">{url}</span>
      <button
        type="button"
        onClick={() => copy(url)}
        className="rounded-full bg-brand-500 text-on-brand text-[11px] font-semibold px-[9px] py-[3px] hover:bg-brand-600 transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};
