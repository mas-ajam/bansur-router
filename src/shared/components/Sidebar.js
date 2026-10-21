"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import LogoMark from "./LogoMark";
import SpecIcon from "./SpecIcon";

/* Nav structure, order, badges and icons follow the Bansur Router Dashboard
   artifact exactly (5 groups: Gateway / Observe / Optimize / Tools / System).
   Icons are the artifact's custom 24-viewBox stroke-1.8 SVGs at 17px. */
const NAV_GROUPS = [
  {
    label: "Gateway",
    items: [
      {
        key: "dashboard",
        href: "/dashboard",
        label: "Dashboard",
        icon: (
          <>
            <rect x="3" y="3" width="8" height="10" rx="1.5" />
            <rect x="13" y="3" width="8" height="6" rx="1.5" />
            <rect x="13" y="11" width="8" height="10" rx="1.5" />
            <rect x="3" y="15" width="8" height="6" rx="1.5" />
          </>
        ),
      },
      {
        key: "providers",
        href: "/dashboard/providers",
        label: "Providers",
        badge: "providers",
        icon: (
          <>
            <rect x="3" y="4" width="18" height="6" rx="1.5" />
            <rect x="3" y="14" width="18" height="6" rx="1.5" />
            <circle cx="7.5" cy="7" r="1" fill="currentColor" />
            <circle cx="7.5" cy="17" r="1" fill="currentColor" />
          </>
        ),
      },
      {
        key: "combos",
        href: "/dashboard/combos",
        label: "Combo & Vision Adapter",
        icon: <path d="M12 3v4m0 0 7 4m-7-4L5 11m14 0v6a2 2 0 0 1-2 2h-3m-9-8v6a2 2 0 0 0 2 2h3" />,
      },
      {
        key: "endpoint",
        href: "/dashboard/endpoint",
        label: "Endpoint & Key",
        icon: <path d="M8 9l-4 3 4 3m8-6 4 3-4 3M13 5l-2 14" />,
      },
    ],
  },
  {
    label: "Observe",
    items: [
      {
        key: "usage",
        href: "/dashboard/usage",
        label: "Usage",
        icon: <path d="M4 20V10m5.5 10V4M15 20v-8m5 8V7" />,
      },
      {
        key: "quota",
        href: "/dashboard/quota",
        label: "Quota Tracker",
        icon: (
          <>
            <path d="M12 3a9 9 0 1 0 9 9h-9z" />
            <path d="M15 2.5A9 9 0 0 1 21.5 9H15z" />
          </>
        ),
      },
      {
        key: "console-log",
        href: "/dashboard/console-log",
        label: "Console Log",
        badge: "live",
        icon: <path d="m5 7 5 5-5 5m7 0h7" />,
      },
    ],
  },
  {
    label: "Optimize",
    items: [
      {
        key: "token-saver",
        href: "/dashboard/token-saver",
        label: "Token Saver",
        icon: <path d="M12 3v18m5-15.5c-.8-1-2.6-1.5-5-1.5-3 0-5 1.3-5 3.2 0 4.4 10 2.4 10 6.6 0 1.9-2 3.2-5 3.2-2.4 0-4.2-.6-5-1.6" />,
      },
      {
        key: "pxpipe",
        href: "/dashboard/pxpipe",
        label: "PXPIPE",
        icon: (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18M8 15h5" />
          </>
        ),
      },
      {
        key: "translator",
        href: "/dashboard/translator",
        label: "Translator",
        icon: <path d="M4 6h9M8.5 4v2c0 3.5-2 6.5-4.5 8.5M6 9.5c1 2.5 3.2 4.7 6 6M13 20l4.5-10L22 20m-7.8-3h6.6" />,
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        key: "cli-tools",
        href: "/dashboard/cli-tools",
        label: "CLI Tools",
        icon: (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m7 9 3 3-3 3m5 0h5" />
          </>
        ),
      },
      {
        key: "basic-chat",
        href: "/dashboard/basic-chat",
        label: "Basic Chat",
        icon: <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z" />,
      },
      {
        key: "skills",
        href: "/dashboard/skills",
        label: "Skills",
        icon: (
          <>
            <path d="M9 3v4L4 9l2 3-2 3 5 2v4h6v-4l5-2-2-3 2-3-5-2V3z" />
            <circle cx="12" cy="12" r="2.4" />
          </>
        ),
      },
      {
        key: "media",
        href: "/dashboard/media-providers",
        label: "Media Providers",
        icon: (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m4 18 5-4 4 3 3-2 4 3" />
          </>
        ),
      },
      {
        key: "web",
        href: "/dashboard/media-providers/web",
        label: "Web Fetch & Search",
        sub: true,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        key: "proxy-pools",
        href: "/dashboard/proxy-pools",
        label: "Proxy Pools",
        icon: (
          <>
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <path d="M8 7.5 10.5 16M16 7.5 13.5 16M8.5 6h7" />
          </>
        ),
      },
      {
        key: "mitm",
        href: "/dashboard/mitm",
        label: "MITM",
        icon: (
          <>
            <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z" />
            <path d="m9 12 2 2 4-4.5" />
          </>
        ),
      },
      {
        key: "profile",
        href: "/dashboard/profile",
        label: "Profile",
        icon: (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20.5c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
          </>
        ),
      },
      {
        key: "settings",
        href: "/dashboard/settings",
        label: "Settings",
        icon: (
          <>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
          </>
        ),
      },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [connectedCount, setConnectedCount] = useState(null);

  // Providers badge ("{n} connected") — real count from /api/providers
  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = data.connections || [];
        setConnectedCount(list.filter((c) => c.isActive !== false).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isItemActive = (item) => {
    switch (item.key) {
      case "dashboard":
        return pathname === "/dashboard";
      case "endpoint":
        return pathname.startsWith("/dashboard/endpoint");
      case "media":
        return (
          pathname.startsWith("/dashboard/media-providers") &&
          !pathname.startsWith("/dashboard/media-providers/web")
        );
      case "web":
        return pathname.startsWith("/dashboard/media-providers/web");
      case "profile":
        return pathname.startsWith("/dashboard/profile");
      case "settings":
        return pathname.startsWith("/dashboard/settings");
      default:
        return pathname.startsWith(item.href);
    }
  };

  const badgeText = (item) => {
    if (item.badge === "providers") {
      return connectedCount === null ? null : `${connectedCount} connected`;
    }
    if (item.badge === "live") return "live";
    return null;
  };

  return (
    <aside className="flex w-[236px] shrink-0 flex-col bg-sidebar-bg text-sidebar-text h-full">
      {/* Brand */}
      <div className="px-[18px] pt-[18px] pb-3.5 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-[11px]">
          <LogoMark size={38} className="text-white shrink-0" />
          <div className="flex flex-col leading-[1.15]">
            <span className="text-[13.5px] font-bold tracking-[0.22em] text-white">BANSUR</span>
            <span className="text-[11px] tracking-[0.06em] text-sidebar-muted">ROUTER</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-2.5 py-3 overflow-y-auto scrollbar-none">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#5d666e]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isItemActive(item);
              const badge = badgeText(item);
              if (item.sub) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center py-[7px] pr-2.5 pl-[38px] rounded-md mb-px text-[12.5px] font-medium transition-colors",
                      active
                        ? "bg-white text-[#101418]"
                        : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md mb-px text-[13px] font-medium transition-colors",
                    active
                      ? "bg-white text-[#101418]"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  )}
                >
                  <SpecIcon className={cn("shrink-0", active ? "opacity-100" : "opacity-75")}>
                    {item.icon}
                  </SpecIcon>
                  <span>{item.label}</span>
                  {badge && (
                    <span
                      className={cn(
                        "ml-auto font-mono text-[10.5px] px-1.5 rounded-full border",
                        active
                          ? "border-[#c9ced3] text-text-muted"
                          : "border-[#39414a] text-sidebar-muted"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-[18px] py-3 flex items-center justify-between text-[11.5px] text-sidebar-muted">
        <span>Bansur Router</span>
        <span className="font-mono text-[#9aa3ab]">v{APP_CONFIG.version}</span>
      </div>
    </aside>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};
