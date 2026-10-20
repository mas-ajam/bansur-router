"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import { APP_CONFIG } from "@/shared/constants/config";
import Sidebar from "../Sidebar";
import Header from "../Header";
import LogoMark from "../LogoMark";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [port, setPort] = useState("");
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);

  useEffect(() => {
    if (typeof window !== "undefined") setPort(window.location.port || "667");
  }, []);

  // Preload heavy usage charts in background when browser is idle
  useEffect(() => {
    const preload = () => {
      import("@/shared/components/UsageStats").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/UsageChart").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/ProviderBarChart").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/TopModelsChart").catch(() => {});
    };
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(preload, { timeout: 4000 });
        return () => window.cancelIdleCallback(id);
      }
      const timer = setTimeout(preload, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* Toasts — artifact .toast: bottom-center ink pill, no icon, no close */}
      <div className="fixed bottom-[22px] left-1/2 z-[100] flex w-full max-w-[min(92vw,560px)] -translate-x-1/2 flex-col items-center gap-2 px-4 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="rounded-full bg-brand-500 px-4 py-[9px] text-center text-[13px] font-medium text-on-brand shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          >
            {n.title ? <span className="font-semibold">{n.title} — </span> : null}
            <span className="whitespace-pre-wrap break-words">{n.message}</span>
          </div>
        ))}
      </div>
      {/* Mobile sidebar overlay — artifact scrim rgba(11,14,17,.55) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0b0e11]/55 min-[821px]:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <div className="hidden min-[821px]:flex">
        <Sidebar />
      </div>

      {/* Sidebar - Mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform min-[821px]:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex flex-col flex-1 h-full min-w-0 relative transition-colors duration-300 isolate">
        <Header key={pathname} onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3.5 py-[18px] min-[821px]:p-[26px]">
          <div className="max-w-[1240px] mx-auto">{children}</div>
          {/* Shell foot (audit T-07) */}
          <footer className="max-w-[1240px] mx-auto flex items-center gap-2 pt-[18px] pb-1 text-xs text-text-subtle">
            <LogoMark size={15} className="text-text-subtle shrink-0" />
            <span>
              Bansur Router v{APP_CONFIG.version} · running locally on port {port || "667"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
