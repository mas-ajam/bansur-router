"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/shared/components";
import LogoMark from "@/shared/components/LogoMark";
import { useNotificationStore } from "@/store/notificationStore";

/* Artifact L-05: the ONLY copy shown on a failed login (env var in mono). */
const LOGIN_ERROR_TEXT =
  "Incorrect password. Check the password set via the CLI or the BANSUR_ROUTER_DASHBOARD_PASSWORD environment variable.";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [authMode, setAuthMode] = useState("password");
  const [ssoType, setSsoType] = useState("oidc");
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [oidcLoginLabel, setOidcLoginLabel] = useState("Sign in with OIDC");
  const [samlConfigured, setSamlConfigured] = useState(false);
  const [samlLoginLabel, setSamlLoginLabel] = useState("Sign in with SAML SSO");
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [ssoToast, setSsoToast] = useState(false);
  const notify = useNotificationStore();

  // Countdown for rate-limit (server lockout behavior kept; only its
  // display lines were removed per L-05 — the button stays disabled).
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => setRetryAfter((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  useEffect(() => {
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/auth/status`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated === true || data.requireLogin === false) {
            window.location.assign("/dashboard");
            return;
          }
          setHasPassword(!!data.hasPassword);
          setAuthMode(data.authMode || "password");
          setSsoType(data.ssoType || "oidc");
          setOidcConfigured(data.oidcConfigured === true);
          setOidcLoginLabel(data.oidcLoginLabel || "Sign in with OIDC");
          setSamlConfigured(data.samlConfigured === true);
          setSamlLoginLabel(data.samlLoginLabel || "Sign in with SAML SSO");
        } else {
          // Safe fallback on non-OK response to avoid infinite loading state.
          setHasPassword(true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setHasPassword(true);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mustChangePassword) {
          setMustChange(true);
          return;
        }
        window.location.assign("/dashboard");
      } else {
        const data = await res.json().catch(() => ({}));
        // L-05: display copy is the artifact's fixed string only — the
        // server message / reset hint / lockout countdown are not shown.
        // Lockout itself still applies via retryAfter (button disabled).
        setError(LOGIN_ERROR_TEXT);
        if (data.retryAfter) setRetryAfter(Number(data.retryAfter));
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Force a new password before entering the dashboard (default + remote).
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      if (res.ok) {
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to set password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOidcLogin = () => {
    window.location.href = "/api/auth/oidc/start";
  };

  const handleSamlLogin = () => {
    window.location.href = "/api/auth/saml/start";
  };

  // L-07: SSO button is always rendered; when SSO is not configured the
  // click shows the artifact toast instead of starting a flow.
  const handleSsoNotConfigured = () => {
    notify.info("SSO is not configured on this instance");
    setSsoToast(true);
    setTimeout(() => setSsoToast(false), 2200);
  };

  const isSsoEnabled = ["sso", "oidc", "saml", "both"].includes(authMode);
  const activeSsoType = ssoType || (authMode === "saml" ? "saml" : "oidc");

  const samlAvailable = isSsoEnabled && activeSsoType === "saml" && samlConfigured;
  const oidcAvailable = isSsoEnabled && activeSsoType === "oidc" && oidcConfigured;
  const ssoAvailable = samlAvailable || oidcAvailable;

  const passwordAvailable = authMode === "password" || authMode === "both" || !ssoAvailable;

  const port =
    typeof window !== "undefined" ? window.location.port || "667" : "667";

  // L-02/L-09: .field metrics on the dark card — 8px 11px padding and a
  // 3px rgba(255,255,255,.1) focus ring, overriding the shared Input.
  const darkFieldClassName =
    "bg-[#0d1114] border-[#2b323a] text-[#eef1f3] placeholder:text-[#5d666e] px-[11px] py-2 focus:border-[#eef1f3] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)] rounded-md";

  const renderErrorText = (text) =>
    text === LOGIN_ERROR_TEXT ? (
      <>
        Incorrect password. Check the password set via the CLI or the{" "}
        <span className="font-mono">BANSUR_ROUTER_DASHBOARD_PASSWORD</span>{" "}
        environment variable.
      </>
    ) : (
      text
    );

  // Show loading state while checking password
  if (hasPassword === null) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[#0b0e11] p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[#0b0e11] p-6 relative overflow-hidden">
      {/* Subtle dot pattern (prototype login backdrop) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-[380px] rounded-xl border border-[#262c33] bg-[#12161a] px-[34px] pt-9 pb-[30px] text-[#eef1f3] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="flex justify-center mb-[18px]">
          <LogoMark size={72} className="text-white" />
        </div>
        <h1 className="text-center text-[15px] font-bold tracking-[0.28em] text-white">
          BANSUR ROUTER
        </h1>
        <p className="text-center text-[#8b949c] text-[12.5px] mt-1.5 mb-[26px]">
          {samlAvailable
            ? "Sign in with SAML 2.0 Single Sign-On"
            : oidcAvailable
            ? "Sign in with your OIDC provider to access the dashboard"
            : "Local AI gateway · dashboard sign in"}
        </p>

        <div>
          {mustChange ? (
            <form onSubmit={handleSetNewPassword} className="flex flex-col">
              <p className="text-sm text-text-muted text-center mb-4">
                Set a new password before accessing the dashboard remotely.
              </p>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12.5px] font-semibold text-[#c9ced3]">New password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  inputClassName={darkFieldClassName}
                />
              </div>
              {error && <p className="mt-[14px] rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{renderErrorText(error)}</p>}
              <Button type="submit" variant="primary" className="w-full h-10 text-sm mt-[18px] hover:!bg-[#e8ebed] hover:!border-[#e8ebed]" loading={loading} disabled={!newPassword}>
                Set password
              </Button>
            </form>
          ) : (
          <div className="flex flex-col">
            {passwordAvailable ? (
              <form onSubmit={handleLogin} className="flex flex-col">
                {isSsoEnabled && !ssoAvailable && (
                  <p className="text-xs text-text-muted text-center mb-4">
                    {activeSsoType === "saml" ? "SAML SSO" : "OIDC"} login is enabled, but configuration is incomplete. Password login is still available for recovery.
                  </p>
                )}

                {authMode === "both" && ssoAvailable && (
                  <p className="text-xs text-text-muted text-center mb-4">
                    Password and {activeSsoType === "saml" ? "SAML SSO" : "OIDC"} login are both enabled.
                  </p>
                )}

                {/* L-03: label → field gap 6px */}
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12.5px] font-semibold text-[#c9ced3]">Password</label>
                  <Input
                    type="password"
                    placeholder="Dashboard password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus={!oidcAvailable}
                    inputClassName={darkFieldClassName}
                  />
                </div>
                {error && <p className="mt-[14px] rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{renderErrorText(error)}</p>}

                {/* L-04 + L-08: margin-top 18px, hover #e8ebed */}
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-10 text-sm mt-[18px] hover:!bg-[#e8ebed] hover:!border-[#e8ebed]"
                  loading={loading}
                  disabled={retryAfter > 0}
                >
                  Sign in
                </Button>
              </form>
            ) : (
              error && <p className="rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{renderErrorText(error)}</p>
            )}

            {/* L-07: SSO ghost button(s) — always rendered, no divider,
                margin-top 8px, hover #eef0f1. Configured SSO keeps its
                real sign-in flow and label. */}
            {samlAvailable && (
              <Button type="button" variant={passwordAvailable ? "ghost" : "primary"} className="w-full justify-center text-[#c9ced3] hover:bg-[#eef0f1] mt-2" onClick={handleSamlLogin}>
                {samlLoginLabel}
              </Button>
            )}

            {oidcAvailable && (
              <Button type="button" variant={passwordAvailable ? "ghost" : "primary"} className="w-full justify-center text-[#c9ced3] hover:bg-[#eef0f1] mt-2" onClick={handleOidcLogin}>
                {oidcLoginLabel}
              </Button>
            )}

            {!ssoAvailable && (
              <Button type="button" variant="ghost" className="w-full justify-center text-[#c9ced3] hover:bg-[#eef0f1] mt-2" onClick={handleSsoNotConfigured}>
                Sign in with OIDC
              </Button>
            )}

            {/* L-06: artifact note copy verbatim; no default password. */}
            <div className="mt-5 pt-4 border-t border-[#232930] text-xs leading-[1.55] text-[#7d858e]">
              <p>
                This dashboard is protected by the password you set through the CLI or environment variable when the router was installed. It never leaves this machine — Bansur Router runs entirely on{" "}
                <span className="font-mono text-[#c9ced3]">localhost:{port}</span>.
              </p>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Artifact .toast pill for the not-configured SSO click (the login
          screen has no DashboardLayout toast renderer, so the pill is
          rendered locally; the notification store is also notified). */}
      {ssoToast && (
        <div className="fixed bottom-[22px] left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#101418] px-4 py-[9px] text-center text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          SSO is not configured on this instance
        </div>
      )}
    </div>
  );
}
