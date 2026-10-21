"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useTheme } from "@/shared/hooks/useTheme";
import ChangelogModal from "./ChangelogModal";
import { ConfirmModal } from "./Modal";

/* HeaderGridMenu (Option 2 restoration, §II.24): the pre-removal HeaderMenu
   was a grid-icon menu (Change Log / Theme / Shutdown / Logout). Phase 1
   replaced HeaderMenu.js with the spec avatar menu, which stays untouched;
   this restores the grid menu as a SEPARATE additional topbar control.
   Theme expands to Light / Dark / System choices driving the themeStore
   (batch 1); Shutdown posts to the pre-removal endpoint
   /api/version/shutdown behind a confirm; Logout reuses the avatar menu's
   sign-out flow via the onLogout prop from Header. */
const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "contrast" },
];

function MenuItem({ icon, label, onClick, trailing }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text-main hover:bg-surface-2 transition-colors"
    >
      <span className="material-symbols-outlined text-[20px] text-text-muted">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

MenuItem.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  trailing: PropTypes.node,
};

export default function HeaderGridMenu({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const { theme, setTheme } = useTheme();
  const menuRef = useRef(null);

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/version/shutdown", { method: "POST" });
    } catch {
      // Expected to fail as the server shuts down; ignore.
    }
    setIsShuttingDown(false);
    setShutdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setThemeOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setThemeOpen(false);
  };

  const activeTheme = THEME_OPTIONS.find((o) => o.value === theme) || THEME_OPTIONS[2];

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
          title="Menu"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">grid_view</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-surface border border-border rounded-xl shadow-[var(--shadow-elev)] z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden py-1">
            <MenuItem
              icon="history"
              label="Change Log"
              onClick={() => { close(); setChangelogOpen(true); }}
            />
            <MenuItem
              icon={activeTheme.icon}
              label="Theme"
              onClick={() => setThemeOpen((v) => !v)}
              trailing={
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  {activeTheme.label}
                  <span className="material-symbols-outlined text-[16px]">
                    {themeOpen ? "expand_less" : "expand_more"}
                  </span>
                </span>
              }
            />
            {themeOpen && (
              <div className="border-y border-border bg-surface-2/60 py-1">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); close(); }}
                    className="flex items-center gap-3 w-full pl-[52px] pr-4 py-2 text-[13px] text-text-main hover:bg-surface-2 transition-colors"
                    aria-pressed={theme === opt.value}
                  >
                    <span className="flex-1 text-left">{opt.label}</span>
                    {theme === opt.value && (
                      <span className="material-symbols-outlined text-[16px] text-text-main">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <MenuItem
              icon="power_settings_new"
              label="Shutdown"
              onClick={() => { close(); setShutdownOpen(true); }}
            />
            <MenuItem
              icon="logout"
              label="Logout"
              onClick={() => { close(); onLogout(); }}
            />
          </div>
        )}
      </div>

      <ChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <ConfirmModal
        isOpen={shutdownOpen}
        onClose={() => setShutdownOpen(false)}
        onConfirm={handleShutdown}
        title="Close Proxy"
        message="Are you sure you want to close the proxy server?"
        confirmText="Close"
        cancelText="Cancel"
        variant="danger"
        loading={isShuttingDown}
      />
    </>
  );
}

HeaderGridMenu.propTypes = {
  onLogout: PropTypes.func.isRequired,
};
