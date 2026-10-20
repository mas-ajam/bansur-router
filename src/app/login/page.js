"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/shared/components";
import LogoMark from "@/shared/components/LogoMark";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetHint, setResetHint] = useState("");
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

  // Countdown for rate-limit
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
    setResetHint("");

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
        const data = await res.json();
        setError(data.error || "Invalid password");
        if (data.resetHint) setResetHint(data.resetHint);
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

  const isSsoEnabled = ["sso", "oidc", "saml", "both"].includes(authMode);
  const activeSsoType = ssoType || (authMode === "saml" ? "saml" : "oidc");

  const samlAvailable = isSsoEnabled && activeSsoType === "saml" && samlConfigured;
  const oidcAvailable = isSsoEnabled && activeSsoType === "oidc" && oidcConfigured;
  const ssoAvailable = samlAvailable || oidcAvailable;

  const passwordAvailable = authMode === "password" || authMode === "both" || !ssoAvailable;

  // Show loading state while checking password
  if (hasPassword === null) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[#0b0e11] p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[#0b0e11] p-4 relative overflow-hidden">
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
            <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
              <p className="text-sm text-text-muted text-center">
                Set a new password before accessing the dashboard remotely.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-semibold text-[#c9ced3]">New password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  inputClassName="bg-[#0d1114] border-[#2b323a] text-[#eef1f3] placeholder:text-[#5d666e] focus:ring-white/10 focus:border-[#eef1f3] rounded-md"
                />
                {error && <p className="rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{error}</p>}
              </div>
              <Button type="submit" variant="primary" className="w-full h-10 text-sm" loading={loading} disabled={!newPassword}>
                Set password
              </Button>
            </form>
          ) : (
          <div className="flex flex-col gap-4">
            {passwordAvailable ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                {isSsoEnabled && !ssoAvailable && (
                  <p className="text-xs text-text-muted text-center">
                    {activeSsoType === "saml" ? "SAML SSO" : "OIDC"} login is enabled, but configuration is incomplete. Password login is still available for recovery.
                  </p>
                )}

                {authMode === "both" && ssoAvailable && (
                  <p className="text-xs text-text-muted text-center">
                    Password and {activeSsoType === "saml" ? "SAML SSO" : "OIDC"} login are both enabled.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-semibold text-[#c9ced3]">Password</label>
                  <Input
                    type="password"
                    placeholder="Dashboard password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus={!oidcAvailable}
                    inputClassName="bg-[#0d1114] border-[#2b323a] text-[#eef1f3] placeholder:text-[#5d666e] focus:ring-white/10 focus:border-[#eef1f3] rounded-md"
                  />
                  {error && <p className="rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{error}</p>}
                  {retryAfter > 0 && (
                    <p className="text-xs text-text-muted">
                      Locked. Retry in <span className="font-mono">{retryAfter}s</span>.
                    </p>
                  )}
                  {resetHint && (
                    <p className="text-xs text-text-muted">
                      Forgot password? Open <code className="bg-white/10 px-1 rounded">bansur-router</code> CLI on the host → <b>Settings</b> → <b>Reset Password to Default</b>.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-10 text-sm"
                  loading={loading}
                  disabled={retryAfter > 0}
                >
                  {retryAfter > 0 ? `Wait ${retryAfter}s` : "Sign in"}
                </Button>
              </form>
            ) : (
              error && <p className="rounded-md border border-[#4a525a] bg-[#181d22] px-3 py-[9px] text-[12.5px] text-[#e8ebed]">{error}</p>
            )}

            {ssoAvailable && passwordAvailable && <div className="h-px bg-[#232930]" />}

            {samlAvailable && (
              <Button type="button" variant={passwordAvailable ? "ghost" : "primary"} className="w-full text-[#c9ced3] hover:bg-white/5" onClick={handleSamlLogin}>
                {samlLoginLabel}
              </Button>
            )}

            {oidcAvailable && (
              <Button type="button" variant={passwordAvailable ? "ghost" : "primary"} className="w-full text-[#c9ced3] hover:bg-white/5" onClick={handleOidcLogin}>
                {oidcLoginLabel}
              </Button>
            )}

            <div className="mt-1 pt-4 border-t border-[#232930] text-xs leading-relaxed text-[#7d858e] flex flex-col gap-1.5">
              <p>
                Default password is <code className="bg-white/10 px-1 rounded text-[#c9ced3]">123456</code>
              </p>
              {hasPassword === false && (
                <p>
                  Security risk: no password set. You will be asked to set one when logging in remotely.
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
