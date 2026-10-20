"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import Link from "next/link";

/* Artifact avatar menu (audit T-03): 34px ink circle with initials; menu is
   200px wide with a who-block (name / mono host) and Profile / Settings /
   Sign out items. Replaces the former grid menu (app-only surface). */
function getInitials(name) {
  if (!name) return "LO";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const itemClass =
  "flex w-full items-center gap-2 rounded-[5px] px-2.5 py-2 text-left text-[13px] text-text-main hover:bg-surface-2 transition-colors";

export default function HeaderMenu({ onLogout, displayName = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [host, setHost] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.host);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const close = () => setIsOpen(false);
  const name = displayName || "Local operator";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Account menu"
        className="flex size-[34px] items-center justify-center rounded-full bg-brand-500 text-on-brand text-[12.5px] font-semibold"
      >
        {getInitials(name)}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[44px] w-[200px] rounded-brand border border-border bg-surface p-1.5 shadow-[var(--shadow-soft)] z-50">
          <div className="px-2.5 py-2 border-b border-border mb-1.5">
            <p className="text-[13px] font-bold leading-tight text-text-main">{name}</p>
            <p className="font-mono text-[11.5px] text-text-muted">{host}</p>
          </div>
          <Link href="/dashboard/profile" onClick={close} className={itemClass}>
            Profile
          </Link>
          <Link href="/dashboard/settings" onClick={close} className={itemClass}>
            Settings
          </Link>
          <button
            onClick={() => { close(); onLogout(); }}
            className={itemClass}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

HeaderMenu.propTypes = {
  onLogout: PropTypes.func.isRequired,
  displayName: PropTypes.string,
};
