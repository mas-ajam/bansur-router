"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Toggle, Input, Select, Badge, ConfirmModal, Modal } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { reloadTranslations } from "@/i18n/runtime";

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useState(() => getLocaleFromCookie());
  const [settings, setSettings] = useState({ fallbackStrategy: "fill-first" });
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [passStatus, setPassStatus] = useState({ type: "", message: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [oidcForm, setOidcForm] = useState({
    authMode: "password",
    oidcIssuerUrl: "",
    oidcClientId: "",
    oidcScopes: "openid profile email",
    oidcLoginLabel: "Sign in with OIDC",
  });
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcStatus, setOidcStatus] = useState({ type: "", message: "" });
  const [oidcLoading, setOidcLoading] = useState(false);
  const [oidcTestLoading, setOidcTestLoading] = useState(false);
  const [oidcTestStatus, setOidcTestStatus] = useState({ type: "", message: "" });
  const [oidcExpanded, setOidcExpanded] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const oidcRedirectUri = origin ? `${origin}/api/auth/oidc/callback` : "/api/auth/oidc/callback";
  const samlAcsUrl = origin ? `${origin}/api/auth/saml/acs` : "/api/auth/saml/acs";
  const samlMetadataUrl = origin ? `${origin}/api/auth/saml/metadata` : "/api/auth/saml/metadata";
  
  // SAML State
  const [ssoTypeTab, setSsoTypeTab] = useState("saml");
  const [samlForm, setSamlForm] = useState({
    samlEntryPoint: "",
    samlIssuer: "urn:bansur-router:sp",
    samlCert: "",
    samlLoginLabel: "Sign in with SAML SSO",
    samlAttributeEmail: "email",
    samlAttributeName: "name",
  });
  const [samlStatus, setSamlStatus] = useState({ type: "", message: "" });
  const [samlLoading, setSamlLoading] = useState(false);
  const [samlTestLoading, setSamlTestLoading] = useState(false);
  const [samlTestStatus, setSamlTestStatus] = useState({ type: "", message: "" });
  const [showSamlGuide, setShowSamlGuide] = useState(false);
  const idpMetadataFileRef = useRef(null);
  const certFileRef = useRef(null);

  // DB backup/restore — restored (Option 2 batch 5, PF-03). Endpoints are
  // the pre-removal ones: GET /api/settings/database with the dashboard
  // password in the x-9r-password header (download), POST the parsed
  // backup JSON back to the same route with `password` in the body.
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState({ type: "", message: "" });
  const [dbAuth, setDbAuth] = useState({ open: false, mode: "", password: "" });
  const importFileRef = useRef(null);
  const pendingImportRef = useRef(null);


  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setDisplayName(data?.displayName || "");
        setInstanceName(data?.instanceName || "");
        if (!data?.displayName) {
          fetch("/api/auth/status")
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => { if (s?.displayName) setDisplayName((prev) => prev || s.displayName); })
            .catch(() => {});
        }
        setOidcForm({
          authMode: data?.authMode || "password",
          oidcIssuerUrl: data?.oidcIssuerUrl || "",
          oidcClientId: data?.oidcClientId || "",
          oidcScopes: data?.oidcScopes || "openid profile email",
          oidcLoginLabel: data?.oidcLoginLabel || "Sign in with OIDC",
        });
        setOidcClientSecret("");
        setSsoTypeTab(data?.ssoType || "saml");
        setSamlForm({
          samlEntryPoint: data?.samlEntryPoint || "",
          samlIssuer: data?.samlIssuer || "urn:bansur-router:sp",
          samlCert: data?.samlCert || "",
          samlLoginLabel: data?.samlLoginLabel || "Sign in with SAML SSO",
          samlAttributeEmail: data?.samlAttributeEmail || "email",
          samlAttributeName: data?.samlAttributeName || "name",
        });
        if (
          data?.authMode === "sso" ||
          data?.authMode === "saml" ||
          data?.authMode === "oidc" ||
          data?.authMode === "both"
        ) {
          setOidcExpanded(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        setLoading(false);
      });
  }, []);




  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setPassStatus({ type: "error", message: "Passwords do not match" });
      return;
    }

    setPassLoading(true);
    setPassStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPassStatus({ type: "success", message: "Password updated successfully" });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        setPassStatus({ type: "error", message: data.error || "Failed to update password" });
      }
    } catch (err) {
      setPassStatus({ type: "error", message: "An error occurred" });
    } finally {
      setPassLoading(false);
    }
  };






  const updateOidcForm = (field, value) => {
    setOidcForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveOidcSettings = async (authMode = oidcForm.authMode || "password") => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const loginLabel = oidcForm.oidcLoginLabel.trim();
    const secret = oidcClientSecret.trim();

    if (authMode !== "password" && (!issuerUrl || !clientId || !secret) && !settings.oidcConfigured) {
      setOidcStatus({ type: "error", message: "Issuer URL, client ID, and client secret are required to enable OIDC." });
      return;
    }

    setOidcLoading(true);
    setOidcStatus({ type: "", message: "" });
    setOidcTestStatus({ type: "", message: "" });

    try {
      const payload = {
        authMode,
        ssoType: "oidc",
        oidcIssuerUrl: issuerUrl,
        oidcClientId: clientId,
        oidcScopes: scopes || "openid profile email",
        oidcLoginLabel: loginLabel || "Sign in with OIDC",
      };
      if (secret) {
        payload.oidcClientSecret = secret;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setOidcForm({
          authMode: data?.authMode || authMode,
          oidcIssuerUrl: data?.oidcIssuerUrl || issuerUrl,
          oidcClientId: data?.oidcClientId || clientId,
          oidcScopes: data?.oidcScopes || scopes || "openid profile email",
          oidcLoginLabel: data?.oidcLoginLabel || loginLabel || "Sign in with OIDC",
        });
        setOidcClientSecret("");
        setOidcStatus({
          type: "success",
          message:
            authMode === "oidc"
              ? "OIDC login enabled"
              : authMode === "both"
                ? "Password and OIDC login enabled"
                : "OIDC settings saved",
        });
      } else {
        setOidcStatus({ type: "error", message: data.error || "Failed to save OIDC settings" });
      }
    } catch (err) {
      setOidcStatus({ type: "error", message: "An error occurred" });
    } finally {
      setOidcLoading(false);
    }
  };

  const testOidcConnection = async () => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const secret = oidcClientSecret.trim();

    if (!issuerUrl || !clientId) {
      setOidcTestStatus({ type: "error", message: "Issuer URL and client ID are required to test the connection." });
      return;
    }

    setOidcTestLoading(true);
    setOidcStatus({ type: "", message: "" });
    setOidcTestStatus({ type: "", message: "" });

    try {
      const saveRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authMode: oidcForm.authMode || settings.authMode || "password",
          oidcIssuerUrl: issuerUrl,
          oidcClientId: clientId,
          oidcScopes: scopes || "openid profile email",
          oidcLoginLabel: oidcForm.oidcLoginLabel.trim() || "Sign in with OIDC",
          ...(secret ? { oidcClientSecret: secret } : {}),
        }),
      });

      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setOidcTestStatus({
          type: "error",
          message: saved.error || "Failed to save OIDC settings before testing",
        });
        return;
      }

      const res = await fetch("/api/auth/oidc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerUrl: saved.oidcIssuerUrl || issuerUrl,
          clientId: saved.oidcClientId || clientId,
          scopes: saved.oidcScopes || scopes || "openid profile email",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const statusMessage = data.clientSecretTested
          ? data.clientSecretValid === true
            ? `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret validated too.`
            : `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret was not checked.`
          : `Connection OK. Discovery loaded from ${data.issuerUrl}.`;
        setOidcTestStatus({
          type: "success",
          message: statusMessage,
        });
      } else {
        setOidcTestStatus({ type: "error", message: data.error || "OIDC connection test failed" });
      }
    } catch (err) {
      setOidcTestStatus({ type: "error", message: "An error occurred" });
    } finally {
      setOidcTestLoading(false);
    }
  };

  const updateSamlForm = (field, value) => {
    setSamlForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleIdpMetadataUpload = (event) => {
    const file = event.target.files?.[0];
    if (idpMetadataFileRef.current) idpMetadataFileRef.current.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result || "";
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "text/xml");
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
          setSamlStatus({ type: "error", message: "Unable to parse valid SAML IdP metadata from XML file" });
          return;
        }

        const entityID = doc.documentElement.getAttribute("entityID") || "";
        const ssoNodes = Array.from(doc.querySelectorAll("SingleSignOnService, *|SingleSignOnService"));
        let ssoUrl = "";
        for (const node of ssoNodes) {
          const binding = node.getAttribute("Binding") || "";
          const location = node.getAttribute("Location") || "";
          if (location) {
            ssoUrl = location;
            if (binding.includes("HTTP-Redirect")) break;
          }
        }

        const certNodes = Array.from(doc.querySelectorAll("X509Certificate, *|X509Certificate"));
        let certStr = "";
        if (certNodes.length > 0) {
          certStr = certNodes[0].textContent.trim();
        }

        setSamlForm((prev) => ({
          ...prev,
          samlEntryPoint: ssoUrl || prev.samlEntryPoint,
          samlIssuer: prev.samlIssuer || "urn:bansur-router:sp",
          samlCert: certStr || prev.samlCert,
        }));

        setSamlStatus({
          type: "success",
          message: `IdP Metadata imported! (SSO URL: ${ssoUrl ? "found" : "not found"}, EntityID: ${entityID ? "found" : "not found"}, Cert: ${certStr ? "found" : "not found"})`,
        });
      } catch (err) {
        setSamlStatus({ type: "error", message: "Error reading IdP Metadata XML file" });
      }
    };
    reader.readAsText(file);
  };

  const handleCertFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (certFileRef.current) certFileRef.current.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result || "";
      setSamlForm((prev) => ({ ...prev, samlCert: text.trim() }));
      setSamlStatus({ type: "success", message: "Certificate file loaded into configuration." });
    };
    reader.readAsText(file);
  };

  const saveSamlSettings = async (targetAuthMode = oidcForm.authMode || "password") => {
    setSamlLoading(true);
    setSamlStatus({ type: "", message: "" });
    setSamlTestStatus({ type: "", message: "" });

    try {
      const payload = {
        authMode: targetAuthMode,
        ssoType: "saml",
        samlEntryPoint: samlForm.samlEntryPoint.trim(),
        samlIssuer: samlForm.samlIssuer.trim() || "urn:bansur-router:sp",
        samlCert: samlForm.samlCert.trim(),
        samlLoginLabel: samlForm.samlLoginLabel.trim() || "Sign in with SAML SSO",
        samlAttributeEmail: samlForm.samlAttributeEmail.trim() || "email",
        samlAttributeName: samlForm.samlAttributeName.trim() || "name",
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setSamlForm({
          samlEntryPoint: data?.samlEntryPoint || payload.samlEntryPoint,
          samlIssuer: data?.samlIssuer || payload.samlIssuer,
          samlCert: data?.samlCert || payload.samlCert,
          samlLoginLabel: data?.samlLoginLabel || payload.samlLoginLabel,
          samlAttributeEmail: data?.samlAttributeEmail || payload.samlAttributeEmail,
          samlAttributeName: data?.samlAttributeName || payload.samlAttributeName,
        });
        setSamlStatus({
          type: "success",
          message:
            targetAuthMode === "sso" || targetAuthMode === "saml"
              ? "SAML SSO login enabled"
              : targetAuthMode === "both"
                ? "Password and SAML SSO login enabled"
                : "SAML 2.0 settings saved",
        });
      } else {
        setSamlStatus({ type: "error", message: data.error || "Failed to save SAML settings" });
      }
    } catch {
      setSamlStatus({ type: "error", message: "An error occurred while saving SAML settings" });
    } finally {
      setSamlLoading(false);
    }
  };

  const testSamlConnection = async () => {
    setSamlTestLoading(true);
    setSamlStatus({ type: "", message: "" });
    setSamlTestStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/auth/saml/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samlEntryPoint: samlForm.samlEntryPoint.trim(),
          samlIssuer: samlForm.samlIssuer.trim(),
          samlCert: samlForm.samlCert.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSamlTestStatus({ type: "success", message: data.message || "SAML configuration verified!" });
      } else {
        setSamlTestStatus({ type: "error", message: data.error || "SAML configuration test failed" });
      }
    } catch {
      setSamlTestStatus({ type: "error", message: "An error occurred while testing SAML configuration" });
    } finally {
      setSamlTestLoading(false);
    }
  };

  // --- Operator profile (Phase 3 split) ---
  const notify = useNotificationStore();
  const [displayName, setDisplayName] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "id", label: "Bahasa Indonesia" },
    { value: "ja", label: "Japanese" },
    { value: "zh-CN", label: "Chinese (Simplified)" },
  ];
  const languageValue = LANGUAGE_OPTIONS.some((o) => o.value === locale) ? locale : "en";

  // Same mechanism the old LanguageSwitcher used: POST /api/locale + reload translations.
  const handleLanguageChange = async (nextLocale) => {
    setLocale(nextLocale);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      await reloadTranslations();
    } catch (err) {
      console.error("Failed to set locale:", err);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), instanceName: instanceName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        notify.success("Profile saved");
      } else {
        notify.error(data.error || "Failed to save profile");
      }
    } catch {
      notify.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const updateCloudEnabled = async (cloudEnabled) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data, cloudEnabled }));
      } else {
        notify.error(data.error || "Failed to update cloud sync");
      }
    } catch {
      notify.error("Failed to update cloud sync");
    }
  };

  // PF-11: reset router data — deletes accounts, keys, combos, and logs
  // server-side; settings and the dashboard password are kept.
  const handleResetData = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/settings/reset-data", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify.success("Router data reset");
        setShowResetConfirm(false);
        window.location.reload();
      } else {
        notify.error(data.error || "Failed to reset router data");
      }
    } catch {
      notify.error("Failed to reset router data");
    } finally {
      setResetting(false);
    }
  };

  const handleExportConfig = async () => {
    try {
      const [settingsRes, combosRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/combos", { cache: "no-store" }),
      ]);
      const settingsJson = settingsRes.ok ? await settingsRes.json() : {};
      const combosJson = combosRes.ok ? await combosRes.json() : {};
      const payload = {
        settings: settingsJson,
        combos: combosJson.combos ?? combosJson,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bansur-router-config.json";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      notify.success("Configuration exported");
    } catch {
      notify.error("Failed to export configuration");
    }
  };

  // DB backup/restore handlers — ported from the pre-removal Profile
  // (ea40b73^), including the password-confirm step before either action.
  const reloadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  };

  const handleExportDatabase = async (password) => {
    setDbLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/database", {
        headers: { "x-9r-password": password },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export database");
      }

      const payload = await res.json();
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[.:]/g, "-");
      anchor.href = url;
      anchor.download = `bansur-router-backup-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setDbStatus({ type: "success", message: "Database backup downloaded" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to export database" });
    } finally {
      setDbLoading(false);
    }
  };

  const handleImportDatabase = (event) => {
    const file = event.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = "";
    if (!file) return;
    pendingImportRef.current = file;
    setDbStatus({ type: "", message: "" });
    setDbAuth({ open: true, mode: "import", password: "" });
  };

  const runImportDatabase = async (password) => {
    const file = pendingImportRef.current;
    if (!file) return;
    setDbLoading(true);
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);

      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import database");
      }

      await reloadSettings();
      setDbStatus({ type: "success", message: "Database imported successfully" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Invalid backup file" });
    } finally {
      pendingImportRef.current = null;
      setDbLoading(false);
    }
  };

  // Confirm password modal, then run export or import.
  const handleDbAuthConfirm = async () => {
    const { mode, password } = dbAuth;
    setDbAuth({ open: false, mode: "", password: "" });
    if (mode === "export") await handleExportDatabase(password);
    else if (mode === "import") await runImportDatabase(password);
  };

  const cloudEnabled = settings.cloudEnabled === true;
  const authModeLabel =
    settings.authMode === "both"
      ? "Password + SSO"
      : settings.authMode === "sso" || settings.authMode === "oidc" || settings.authMode === "saml"
        ? settings.ssoType === "saml"
          ? "SAML"
          : "OIDC"
        : "Password";
  const oidcConfigured = settings.oidcConfigured === true;
  const samlConfigured = !!(settings.samlEntryPoint && settings.samlCert);


  return (
    <div>
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Profile</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Operator profile for this router instance, sign-in security, and cloud sync.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2 items-start">
        {/* Operator + password */}
        <Card>
          <h3 className="text-[13.5px] font-semibold mb-3.5">Operator</h3>
          <div className="grid grid-cols-1 min-[821px]:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold mb-1.5">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold mb-1.5">Instance name</label>
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="mt-3.5">
            <label className="block text-[12.5px] font-semibold mb-1.5">Display language</label>
            <Select
              options={LANGUAGE_OPTIONS}
              value={languageValue}
              onChange={(e) => handleLanguageChange(e.target.value)}
            />
          </div>
          <div className="mt-3.5">
            <label className="block text-[12.5px] font-semibold mb-1.5">Database location</label>
            <Input value="~/.bansur-router/db/data.sqlite" readOnly inputClassName="font-mono text-[12.5px]" />
          </div>
          <div className="mt-3.5">
            <Button variant="primary" onClick={handleSaveProfile} loading={profileSaving} disabled={loading}>
              Save profile
            </Button>
          </div>

          <div className="h-px bg-border my-[18px]" />

          <h3 className="text-[13.5px] font-semibold mb-3.5">Change dashboard password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="flex flex-col gap-2.5">
              <Input
                type="password"
                placeholder="Current password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                required={!!settings.hasPassword}
              />
              <Input
                type="password"
                placeholder="New password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                required
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                required
              />
            </div>
            {passStatus.message && (
              <p className="text-xs text-text-muted mt-2.5">{passStatus.message}</p>
            )}
            <div className="flex items-center gap-3.5 mt-3.5 flex-wrap">
              <Button type="submit" variant="secondary" loading={passLoading}>
                Update password
              </Button>
              <span className="text-xs text-text-muted">Running on your machine — the password never leaves it.</span>
            </div>
          </form>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          {/* Appearance — theme segment restored (Option 2 batch 1); additional
              section, spec Profile layout otherwise unchanged. Segmented
              control markup is the pre-removal one (token classes flip via
              the .dark token block). */}
          <Card>
            <h3 className="text-[13.5px] font-semibold mb-3.5">Appearance</h3>
            <div className="flex items-center justify-between gap-3.5 flex-wrap">
              <div>
                <b className="block text-[13.5px] font-semibold">Theme</b>
                <span className="text-[12.5px] text-text-muted">Light, dark, or follow your system.</span>
              </div>
              <div className="inline-flex rounded-md border border-border bg-surface overflow-hidden">
                {["light", "dark", "system"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-[13px] py-1.5 text-[12.5px] font-medium transition-colors border-r border-border last:border-r-0",
                      theme === option
                        ? "bg-brand-500 text-on-brand"
                        : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {option === "light" ? "light_mode" : option === "dark" ? "dark_mode" : "contrast"}
                    </span>
                    <span className="capitalize text-xs sm:text-sm">{option}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Cloud sync */}
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="grow">
                <h3 className="text-[13.5px] font-semibold">Cloud sync</h3>
                <p className="text-xs text-text-muted">Optional sync of settings &amp; provider metadata</p>
              </div>
              <Badge variant="default">{cloudEnabled ? "On" : "Off"}</Badge>
              <Toggle checked={cloudEnabled} onChange={updateCloudEnabled} disabled={loading} />
            </div>
            <div className="mt-2">
              <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px]">
                <span className="text-text-muted">Status</span>
                <span className="font-mono text-[12.5px] text-right">{cloudEnabled ? "Enabled" : "Local mode · nothing synced"}</span>
              </div>
              <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px]">
                <span className="text-text-muted">Last sync</span>
                <span className="font-mono text-[12.5px] text-right">Never</span>
              </div>
              <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
                <span className="text-text-muted">What syncs</span>
                <span className="font-mono text-[12.5px] text-right">Settings, combos · never keys</span>
              </div>
            </div>
          </Card>

          {/* Single sign-on summary */}
          <Card>
            <h3 className="text-[13.5px] font-semibold mb-3.5">Single sign-on</h3>
            <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px]">
              <span className="text-text-muted">Auth mode</span>
              <span className="font-mono text-[12.5px] text-right">{authModeLabel}</span>
            </div>
            <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px]">
              <span className="text-text-muted">OIDC</span>
              <span className="font-mono text-[12.5px] text-right">{oidcConfigured ? "Configured" : "Not configured"}</span>
            </div>
            <div className="flex justify-between gap-3.5 py-2 border-b border-dashed border-border text-[13px] last:border-b-0">
              <span className="text-text-muted">SAML</span>
              <span className="font-mono text-[12.5px] text-right">{samlConfigured ? "Configured" : "Not configured"}</span>
            </div>
            <div className="mt-3.5">
              <Button variant="secondary" onClick={() => setOidcExpanded((v) => !v)}>
                Configure SSO
              </Button>
            </div>
          </Card>

          {/* SSO configuration forms (existing full forms, toggled by Configure SSO) */}
          {oidcExpanded && (
            <Card>
            <div className="flex flex-col gap-4 mt-4">
              <p className="text-[12.5px] text-text-muted">
                Configure enterprise Single Sign-On (SSO) for dashboard access using SAML 2.0 or OIDC.
              </p>

              {/* SSO Protocol Switcher Tabs */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[13.5px]">SSO Protocol</label>
                <div className="flex p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-border">
                  <button
                    type="button"
                    onClick={() => setSsoTypeTab("saml")}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-md font-medium text-xs sm:text-sm transition-all text-center",
                      ssoTypeTab === "saml"
                        ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                        : "text-text-muted hover:text-text-main"
                    )}
                  >
                    SAML 2.0
                  </button>
                  <button
                    type="button"
                    onClick={() => setSsoTypeTab("oidc")}
                    className={cn(
                      "flex-1 py-1.5 px-3 rounded-md font-medium text-xs sm:text-sm transition-all text-center",
                      ssoTypeTab === "oidc"
                        ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                        : "text-text-muted hover:text-text-main"
                    )}
                  >
                    OIDC
                  </button>
                </div>
              </div>

              {/* Auth Mode selection */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[13.5px]">Auth Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      value: "password",
                      title: "Password only",
                      desc: "Keep legacy password login.",
                    },
                    {
                      value: "sso",
                      title: `${ssoTypeTab === "saml" ? "SAML" : "OIDC"} only`,
                      desc: "Require SSO for dashboard access.",
                    },
                    {
                      value: "both",
                      title: "Both",
                      desc: "Allow password or SSO login.",
                    },
                  ].map((option) => {
                    const currentMode = oidcForm.authMode;
                    const active =
                      option.value === "password"
                        ? currentMode === "password"
                        : option.value === "sso"
                          ? currentMode === "sso" || currentMode === "saml" || currentMode === "oidc"
                          : currentMode === "both";
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateOidcForm("authMode", option.value)}
                        className={cn(
                          "text-left rounded-lg border p-3 transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-bg hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                        disabled={loading || oidcLoading || samlLoading}
                      >
                        <p className="font-semibold text-[13.5px]">{option.title}</p>
                        <p className="text-[12.5px] text-text-muted mt-1">{option.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {ssoTypeTab === "saml" ? (
                /* SAML Configuration Panel */
                <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
                  {/* IdP Setup Guidelines Banner & Collapsible Drawer */}
                  <div className="rounded-lg border border-border bg-bg/80 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSamlGuide((prev) => !prev)}
                      className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-surface/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
                        <div>
                          <p className="font-semibold text-xs sm:text-sm text-text-main">
                            IdP Setup Guidelines & Provider Configuration Instructions
                          </p>
                          <p className="text-[11px] text-text-muted">
                            Click to view setup steps for AWS IAM Identity Center, Okta, Entra ID, Keycloak, & Authentik
                          </p>
                        </div>
                      </div>
                      <span
                        className="material-symbols-outlined text-text-muted transition-transform text-lg"
                        style={{ transform: showSamlGuide ? "rotate(180deg)" : "none" }}
                      >
                        expand_more
                      </span>
                    </button>

                    {showSamlGuide && (
                      <div className="p-4 border-t border-border bg-surface/30 text-xs text-text-main flex flex-col gap-3">
                        <div className="p-2.5 rounded border border-primary/20 bg-primary/5 text-primary text-xs">
                          <p className="font-semibold mb-1">🔑 Required Service Provider (SP) Values for your IdP Setup:</p>
                          <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                            <li>
                              <b>Assertion Consumer Service (ACS) URL:</b>{" "}
                              <code className="bg-bg px-1 py-0.5 rounded break-all">{samlAcsUrl}</code>
                            </li>
                            <li>
                              <b>SP Entity ID / Audience URI:</b>{" "}
                              <code className="bg-bg px-1 py-0.5 rounded break-all">{samlForm.samlIssuer || "urn:bansur-router:sp"}</code>
                            </li>
                            <li>
                              <b>NameID Format:</b>{" "}
                              <code className="bg-bg px-1 py-0.5 rounded">EmailAddress</code> or <code className="bg-bg px-1 py-0.5 rounded">Unspecified</code>
                            </li>
                          </ul>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                            <p className="font-semibold text-text-main flex items-center gap-1.5">
                              <span>☁️</span> AWS IAM Identity Center
                            </p>
                            <ol className="list-decimal pl-4 text-text-muted space-y-1">
                              <li>Applications → <b>Add application</b> → Select <b>Add custom SAML 2.0 application</b>.</li>
                              <li>Set <b>Application ACS URL</b> to <code className="text-text-main font-mono">{samlAcsUrl}</code>.</li>
                              <li>Set <b>Application SAML audience</b> to <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:bansur-router:sp"}</code>.</li>
                              <li>Under <i>Attribute mappings</i>, map <code className="text-text-main font-mono">Subject</code> or <code className="text-text-main font-mono">email</code> to <code className="text-text-main font-mono">${`{user:email}`}</code>.</li>
                              <li>Download <b>IAM Identity Center SAML metadata XML</b> file and use 1-Click Import below!</li>
                            </ol>
                          </div>

                          <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                            <p className="font-semibold text-text-main flex items-center gap-1.5">
                              <span>🔷</span> Microsoft Entra ID (Azure AD)
                            </p>
                            <ol className="list-decimal pl-4 text-text-muted space-y-1">
                              <li>Enterprise Applications → <b>New application</b> → <b>Create your own application</b>.</li>
                              <li>Select <b>Single sign-on</b> → <b>SAML</b>.</li>
                              <li><b>Identifier (Entity ID):</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:bansur-router:sp"}</code></li>
                              <li><b>Reply URL (ACS):</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                              <li>Download <b>Federation Metadata XML</b> and import or copy X.509 Certificate.</li>
                            </ol>
                          </div>

                          <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                            <p className="font-semibold text-text-main flex items-center gap-1.5">
                              <span>🟢</span> Okta / Auth0
                            </p>
                            <ol className="list-decimal pl-4 text-text-muted space-y-1">
                              <li>Applications → <b>Create App Integration</b> → Select <b>SAML 2.0</b>.</li>
                              <li><b>Single Sign-On URL:</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                              <li><b>Audience URI (SP Entity ID):</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:bansur-router:sp"}</code></li>
                              <li>Name ID format: <i>EmailAddress</i>.</li>
                              <li>Download Identity Provider metadata XML or copy the X.509 cert.</li>
                            </ol>
                          </div>

                          <div className="p-3 rounded border border-border bg-bg/50 flex flex-col gap-1.5">
                            <p className="font-semibold text-text-main flex items-center gap-1.5">
                              <span>🛡️</span> Keycloak / Authentik
                            </p>
                            <ol className="list-decimal pl-4 text-text-muted space-y-1">
                              <li>Clients → <b>Create client</b> → Select <b>SAML</b>.</li>
                              <li><b>Client ID:</b> <code className="text-text-main font-mono">{samlForm.samlIssuer || "urn:bansur-router:sp"}</code></li>
                              <li><b>Master SAML Processing URL:</b> <code className="text-text-main font-mono">{samlAcsUrl}</code></li>
                              <li>Export SAML Descriptor XML or copy IDP Certificate PEM.</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Import Card */}
                  <div className="p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-text-main">1-Click IdP Metadata XML Import</p>
                      <p className="text-xs text-text-muted">Auto-fill SSO URL, Issuer & Cert from XML metadata</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon="upload_file"
                      onClick={() => idpMetadataFileRef.current?.click()}
                    >
                      Upload Metadata XML
                    </Button>
                    <input
                      ref={idpMetadataFileRef}
                      type="file"
                      accept=".xml,application/xml,text/xml"
                      className="hidden"
                      onChange={handleIdpMetadataUpload}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Single Sign-On Service URL (samlEntryPoint)</label>
                      <Input
                        placeholder="https://idp.example.com/app/saml/sso/..."
                        value={samlForm.samlEntryPoint}
                        onChange={(e) => updateSamlForm("samlEntryPoint", e.target.value)}
                        disabled={loading || samlLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">SP Entity ID / Audience (samlIssuer)</label>
                      <Input
                        placeholder="urn:bansur-router:sp"
                        value={samlForm.samlIssuer}
                        onChange={(e) => updateSamlForm("samlIssuer", e.target.value)}
                        disabled={loading || samlLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-[13.5px]">IdP X.509 Certificate (samlCert)</label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon="file_upload"
                          onClick={() => certFileRef.current?.click()}
                        >
                          Upload Certificate
                        </Button>
                        <input
                          ref={certFileRef}
                          type="file"
                          accept=".crt,.pem,.cer,text/plain"
                          className="hidden"
                          onChange={handleCertFileUpload}
                        />
                      </div>
                      <textarea
                        rows={4}
                        placeholder="-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----"
                        value={samlForm.samlCert}
                        onChange={(e) => updateSamlForm("samlCert", e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-border bg-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        disabled={loading || samlLoading}
                      />
                      <p className="text-xs text-text-muted">Paste raw Base64 certificate or PEM block.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="font-semibold text-[13.5px]">Login Button Label</label>
                        <Input
                          placeholder="Sign in with SAML SSO"
                          value={samlForm.samlLoginLabel}
                          onChange={(e) => updateSamlForm("samlLoginLabel", e.target.value)}
                          disabled={loading || samlLoading}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="font-semibold text-[13.5px]">Email Claim Attribute</label>
                        <Input
                          placeholder="email"
                          value={samlForm.samlAttributeEmail}
                          onChange={(e) => updateSamlForm("samlAttributeEmail", e.target.value)}
                          disabled={loading || samlLoading}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="font-semibold text-[13.5px]">Display Name Claim</label>
                        <Input
                          placeholder="name"
                          value={samlForm.samlAttributeName}
                          onChange={(e) => updateSamlForm("samlAttributeName", e.target.value)}
                          disabled={loading || samlLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-bg text-[12.5px] text-text-muted">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-text-main">ACS Callback URL</p>
                        <code className="block break-all font-mono text-xs">{samlAcsUrl}</code>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon="content_copy"
                        onClick={() => {
                          navigator.clipboard.writeText(samlAcsUrl);
                          setSamlStatus({ type: "success", message: "ACS URL copied to clipboard!" });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <div>
                        <p className="font-medium text-text-main">SP XML Metadata</p>
                        <code className="block break-all font-mono text-xs">{samlMetadataUrl}</code>
                      </div>
                      <a
                        href={samlMetadataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download="bansur-router-sp-metadata.xml"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Download XML
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
                    <Button
                      type="button"
                      variant="primary"
                      loading={samlLoading}
                      onClick={() => saveSamlSettings(oidcForm.authMode)}
                      className="w-full sm:w-auto"
                    >
                      Save SAML settings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      loading={samlTestLoading}
                      onClick={testSamlConnection}
                      className="w-full sm:w-auto"
                    >
                      Test SAML settings
                    </Button>
                  </div>

                  {samlTestStatus.message && (
                    <p className={`text-xs sm:text-sm ${samlTestStatus.type === "error" ? "text-text-main" : "text-text-main"}`}>
                      {samlTestStatus.message}
                    </p>
                  )}

                  {samlStatus.message && (
                    <p className={`text-xs sm:text-sm ${samlStatus.type === "error" ? "text-text-main" : "text-text-main"}`}>
                      {samlStatus.message}
                    </p>
                  )}
                </div>
              ) : (
                /* OIDC Panel */
                <div className="flex flex-col gap-4 pt-2 border-t border-border/50">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Issuer URL</label>
                      <Input
                        placeholder="https://auth.example.com/application/o/bansur-router/"
                        value={oidcForm.oidcIssuerUrl}
                        onChange={(e) => updateOidcForm("oidcIssuerUrl", e.target.value)}
                        disabled={loading || oidcLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Client ID</label>
                      <Input
                        placeholder="bansur-router-dashboard"
                        value={oidcForm.oidcClientId}
                        onChange={(e) => updateOidcForm("oidcClientId", e.target.value)}
                        disabled={loading || oidcLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Client Secret</label>
                      <Input
                        type="password"
                        placeholder="Leave blank to keep existing secret"
                        value={oidcClientSecret}
                        onChange={(e) => setOidcClientSecret(e.target.value)}
                        disabled={loading || oidcLoading}
                      />
                      <p className="text-[12.5px] text-text-muted">This value is write-only after saving.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Scopes</label>
                      <Input
                        placeholder="openid profile email"
                        value={oidcForm.oidcScopes}
                        onChange={(e) => updateOidcForm("oidcScopes", e.target.value)}
                        disabled={loading || oidcLoading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-[13.5px]">Login Button Label</label>
                      <Input
                        placeholder="Sign in with OIDC"
                        value={oidcForm.oidcLoginLabel}
                        onChange={(e) => updateOidcForm("oidcLoginLabel", e.target.value)}
                        disabled={loading || oidcLoading}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-bg p-3 text-[12.5px] text-text-muted">
                    <p className="font-medium text-text-main mb-1">Redirect URI</p>
                    <code className="block break-all font-mono">{oidcRedirectUri}</code>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
                    <Button type="button" variant="primary" loading={oidcLoading} onClick={() => saveOidcSettings()} className="w-full sm:w-auto">
                      Save OIDC settings
                    </Button>
                    <Button type="button" variant="outline" loading={oidcTestLoading} onClick={testOidcConnection} className="w-full sm:w-auto">
                      Test connection
                    </Button>
                  </div>

                  {oidcTestStatus.message && (
                    <p className={`text-xs sm:text-sm ${oidcTestStatus.type === "error" ? "text-text-main" : "text-text-main"}`}>
                      {oidcTestStatus.message}
                    </p>
                  )}

                  {oidcStatus.message && (
                    <p className={`text-xs sm:text-sm ${oidcStatus.type === "error" ? "text-text-main" : "text-text-main"}`}>
                      {oidcStatus.message}
                    </p>
                  )}
                </div>
              )}

              {settings.authMode === "oidc" || settings.authMode === "saml" || settings.authMode === "sso" ? (
                <p className="text-[12.5px] text-text-muted dark:text-text-muted">
                  SSO login ({settings.ssoType === "saml" ? "SAML 2.0" : "OIDC"}) is currently active. Password login is disabled until you switch back.
                </p>
              ) : null}

              {settings.authMode === "both" && (
                <p className="text-[12.5px] text-text-muted dark:text-text-muted">
                  Password and SSO login ({settings.ssoType === "saml" ? "SAML 2.0" : "OIDC"}) are both active.
                </p>
              )}
            </div>
            </Card>
          )}

          {/* Database backup — restored (Option 2 batch 5, PF-03):
              Download Backup / Import Backup against /api/settings/database,
              gated by the same password-confirm modal as pre-removal. */}
          <Card>
            <h3 className="text-[13.5px] font-semibold mb-3.5">Database backup</h3>
            <p className="text-[12.5px] text-text-muted mb-3.5">
              Full backup of the local database (accounts, keys, combos, settings) as JSON. Restoring replaces the current database contents.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                icon="download"
                onClick={() => setDbAuth({ open: true, mode: "export", password: "" })}
                loading={dbLoading}
                className="w-full sm:w-auto"
              >
                Download Backup
              </Button>
              <Button
                variant="outline"
                icon="upload"
                onClick={() => importFileRef.current?.click()}
                disabled={dbLoading}
                className="w-full sm:w-auto"
              >
                Import Backup
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportDatabase}
              />
            </div>
            {dbStatus.message && (
              <p className="text-sm text-text-main mt-3">{dbStatus.message}</p>
            )}
          </Card>

          {/* Danger zone */}
          <Card className="border-brand-500">
            <h3 className="text-[13.5px] font-semibold mb-3.5">Danger zone</h3>
            <div className="flex items-center gap-3.5 py-[13px] pt-0 border-b border-border">
              <div className="grow">
                <b className="block text-[13.5px] font-semibold">Reset router data</b>
                <span className="text-[12.5px] text-text-muted">Deletes accounts, keys, combos, and logs stored on this machine.</span>
              </div>
              <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
                Reset…
              </Button>
            </div>
            <div className="flex items-center gap-3.5 py-[13px] border-b border-border last:border-b-0 pb-0">
              <div className="grow">
                <b className="block text-[13.5px] font-semibold">Export configuration</b>
                <span className="text-[12.5px] text-text-muted">Download settings and combos (keys excluded) as JSON.</span>
              </div>
              <Button variant="secondary" onClick={handleExportConfig}>
                Export
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* DB backup/restore password confirm — pre-removal modal (PF-03) */}
      <Modal
        isOpen={dbAuth.open}
        onClose={() => setDbAuth({ open: false, mode: "", password: "" })}
        title="Confirm Password"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDbAuth({ open: false, mode: "", password: "" })} disabled={dbLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDbAuthConfirm} loading={dbLoading} disabled={!dbAuth.password}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-text-muted mb-3 text-sm">
          Enter your current password to {dbAuth.mode === "export" ? "export" : "import"} the database.
        </p>
        <Input
          type="password"
          value={dbAuth.password}
          onChange={(e) => setDbAuth((s) => ({ ...s, password: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter" && dbAuth.password) handleDbAuthConfirm(); }}
          placeholder="Current password"
          autoFocus
        />
      </Modal>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => !resetting && setShowResetConfirm(false)}
        onConfirm={handleResetData}
        title="Reset router data"
        message="Deletes accounts, keys, combos, and logs stored on this machine. Settings and your dashboard password are kept. This cannot be undone."
        confirmText="Reset…"
        variant="danger"
        loading={resetting}
      />
    </div>
  );
}
