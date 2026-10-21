# Changelog — Bansur Router

All notable changes to Bansur Router will be documented in this file.

## 1.0.9 (2026-10-21)

- **Fix: "HTTP 401: Missing API key" when testing models on a fresh install.** Test Model sends its check through the gateway with the dashboard's first API key, and that key used to be created only when the Endpoint & Key page was opened — so on a new install that went straight to Providers, every model test failed with a misleading 401. The Default Key is now provisioned automatically when the server starts; existing installs heal on their next start after updating.
- **Ten fixes from a deep functional audit against upstream behavior.** The mobile navigation drawer could not be scrolled; the endpoint Copy button did nothing on plain-HTTP origins (LAN / nip.io access); a data reset left Test Model broken until a restart; a saved log level silently overrode the `LOG_LEVEL` environment variable; the in-app update action reported success in Local Mode while doing nothing; a non-strict proxy pool whose endpoints all errored silently fell back to a direct connection instead of failing openly; a per-combo Vision Adapter setting could force the adapter on while it was globally off; some MiMo login page templates had gone missing; and the PXPIPE cache hit rate was computed from the wrong denominator.
- **Dashboard extras restored, styled to the current design.** Everything the design-parity rebuild had removed as out-of-spec is back as an addition on top of the spec layouts: the full dark theme (light/dark/system), the shell language switcher, the grid menu (Change Log, Shutdown, Logout), tunnel & Tailscale controls with full per-key access controls on Endpoint & Key, the Usage topology graph plus Request Logger and Request Details, Quota reset-credits / auto-ping / hide-rows controls, Providers Test All with its results modal, Token Saver's Headroom / Caveman / Ponytail sections, PXPIPE savings chart, history and logs, Proxy Pools Batch Import and relay deploy, the Translator pipeline debugger as an advanced mode, per-tool CLI detail pages, Basic Chat attachments and session history, Profile database backup/restore, the pricing editor, and the sidebar update banner.
- **Removed permanently, by owner decision: Bansur Remote and Donate.** Both features are gone entirely (sidebar entry, buttons, modals). The same pass purged every remaining trace of the old upstream brand from the product: internal headers are unified under the `x-bansur-router-*` names (the legacy `x-9router-connection-id` response alias is dropped), brand-derived token salts and cookie names were renamed, upstream issue/PR references were scrubbed from comments and tests, and the inherited `gitbook/` documentation archive was deleted.
- ⚠️ **Breaking:** because internal identifiers changed in the purge, CLI-tool tokens derived before this release are no longer valid — reconnect your CLI tools once after updating. MiMo web-login sessions are reset the same way.
- **Fix: "Models served" card showed the wrong provider prefix.** The Provider Detail card printed a hardcoded `kr/` in front of every provider's models (a leftover from the design mock's Kiro page), so OpenCode models appeared as `kr/…`. It now shows each provider's real alias (`oc/…`, `kr/…`, your custom prefix, …).
- **Fix: Combos "+ Add model" was unusable without any connected account.** The combo form's model picker only listed providers with a stored connection, so on an install using only no-account free providers the list was empty and no combo could be created. The picker now also includes no-auth providers and compatible nodes that carry custom models — the same sources as upstream — while still honoring provider deactivation.
- **Note:** the provider cards' key suffix (last 4 characters) and quota snapshot on the providers API were reviewed and are kept by owner decision (finding F-12) — display-only, behind dashboard authentication, as before.

## 1.0.8 (2026-10-21)

- **Dashboard rebuilt to full design parity.** Every screen was audited value-by-value against the approved design (192 checkpoints) and rebuilt to match it exactly: design tokens and primitives (fields, buttons, badges, toasts), a five-group sidebar with a real Overview as the home screen, a light request table replacing the Console Log terminal, Usage as a single 7-day page with the design's chart and tables, Combos and Translator in their two-pane forms, Media Providers as one page with a working Web test panel, and Profile and Settings as separate screens. Surfaces the design does not define were removed rather than restyled — including the dark theme, the Donate button, the language switcher, and the third-party Remote/English promo sidebar entries.
- **Real data behind every display.** New backend instrumentation so nothing on screen is decorative: RTK compression telemetry (Tokens saved by RTK, Compression today, saved-by-output-type), fallback event logging with recovered-request accounting, per-request routing records in Console Log (combo step, account, quota check, RTK saved, request id), usage aggregates (deltas, peak time, uptime, current route), a real PXPIPE transform cache with server-side p50 and hit rate, persistent per-provider last-test results, combo outcome tracking and per-combo Vision Adapter settings, and quota snapshots (plan, remaining %, key suffix) on provider cards.
- **Proxy Pools grow a real model.** Pools now hold multiple endpoints with rotation strategies (round-robin, latency, sticky), per-endpoint health probing every 60 seconds, and used-by attribution; the router picks a healthy endpoint per strategy.
- **Skills get a backend.** Skill packs now carry server-side state (category, version, enabled) and can be imported from a Git URL; MITM shows the root CA's SHA-256 fingerprint with a certificate download; settings for port, log level, routing strategy (including the new "Most quota remaining"), and local mode are actually consumed by the server; a scoped router data reset lives in Profile's danger zone.
- **Preserved in full:** Available Models on every provider (per-model toggles, Thinking level, Active All, Add Model, disabled list) and Custom Providers (OpenAI/Anthropic Compatible) creation, editing, and testing — verified end-to-end.
- **Fixes:** Console Log text was nearly invisible on the terminal (dark text token on black) and level colors never applied due to a tag-parsing bug; Quota Tracker now shows a proper empty state; a `fly.toml` for one-command Fly.io deploys ships in the repo (the app port maps to 3000 there because Fly forbids binding privileged ports).

## 1.0.7 (2026-10-20)

- **Dashboard layouts aligned to the new design, screen by screen.** Following 1.0.6's design system, every main screen's layout now follows the same composition: a 236px dark sidebar with the endpoint chip in a 58px top bar, content capped at 1240px, the prototype's page-header pattern (title, muted subtitle, actions), and its card grids, stat cards (muted label, mono numerals), and table metrics (uppercase 11px headers, 14px cell padding) across Endpoint & Key, Providers, Usage, Quota Tracker, Token Saver, Console Log, CLI Tools, Proxy Pools, Skills, Media Providers, Profile, and Settings. The login screen is the prototype's single dark card. Where the app's live features differ from a static mock (live quota widgets on provider connections, the streaming console terminal, the translator's pipeline debugger), the layout was adapted around the real functionality instead of faking the mock — no data or behavior changes anywhere.

## 1.0.6 (2026-10-20)

- **Dashboard rebuilt from scratch.** The web dashboard gets the full monochrome mesh design system introduced with the 1.0.5 identity: ink `#101418` palette (the previous orange theme is gone from the interface), IBM Plex Sans/Mono typography, a dark sidebar rail with the mesh logo and BANSUR ROUTER wordmark in both light and dark modes, monochrome status indicators, and a redesigned dark login screen. All screens — providers, combos, usage, quota, token saver, console log, translator, and the rest — were restyled to the new system. Styling only: no behavior, data, or API changes.
- **Every README rewritten from zero.** The main README is fully new (346 lines: intro, Why, Quick Start, How It Works, features, providers, API reference, setup guide, FAQ, troubleshooting) and the same structure now covers all 11 translations, the CLI package README, and the Docker Hub overview.

## 1.0.5 (2026-10-20)

- **New visual identity, designed from scratch.** Bansur Router gets its own monochrome mesh logo (a network of nodes in a ring — many providers, one gateway), replacing the placeholder mark. New assets: logo SVGs (ink + light variants), app tile, README banner, social preview image, favicon and PWA icons, and a docs icon.
- **README redesigned from zero.** New header and structure with original copy for the intro, Why, and Quick Start sections; the inherited emoji-heavy heading style is gone throughout the README family (main, CLI, Docker Hub, and all translations).
- Removed unused Next.js template images (`next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg`) left over in `public/`.

## 1.0.4 (2026-10-20)

- **Default port changed from 20128 to 667.** The old port was inherited from the upstream project; 667 is Bansur Router's own. This applies everywhere: the CLI (`bansur-router` now serves on http://localhost:667), the dashboard/API base URLs, OAuth callback, Docker image (`EXPOSE 667`), and docker-compose (`667:667`). Existing setups can keep any port with `--port` / `-p` or the `PORT` env var.
- ⚠️ Linux/macOS note: 667 is a privileged port (<1024) — start the CLI with `sudo bansur-router` there, or pick an unprivileged port via `--port`. Windows and Docker are unaffected.

## 1.0.3 (2026-10-20)

- **Fix: Antigravity, Gemini, and iFlow connections failing with "client_secret is missing".** The providers' OAuth client values — the same public values the upstream open-source project bundles — are embedded in the source again, so these providers connect out of the box. The `BANSUR_ROUTER_*_CLIENT_SECRET` / `BANSUR_ROUTER_WINDSURF_FIREBASE_API_KEY` environment variables remain available as optional overrides. Windsurf's Firebase API key is restored the same way.

## 1.0.2 (2026-10-20)

- Branding unified across all channels: the Bansur Router logo now heads the npm and Docker Hub package pages, the npm package description matches the official tagline, and the GitHub repository gained topics (ai-router, ai-gateway, openai-compatible, claude-code, cursor, codex, gemini, llm, …).
- Fully automated release pipeline: pushing a version tag now publishes to npm (Trusted Publishing/OIDC with provenance), creates the GitHub Release from this changelog, publishes Docker Hub + GHCR images, and deploys the documentation site — no manual steps.
- Docker Hub overview is synced automatically from `DOCKERHUB.md`; docs deploy automatically to Cloudflare Pages on every release.
- Retired the legacy GitBook-to-GitHub-Pages workflow (documentation lives on Cloudflare Pages).

## 1.0.1 (2026-10-20)

- npm releases now use Trusted Publishing (OIDC) from GitHub Actions — no stored npm tokens — and ship with provenance attestations.
- Added `repository` and `homepage` metadata to the `bansur-router` npm package.
- Fixed the Docker publish workflow: the GHCR image name is now computed inside each job, because passing it through job outputs was blanked by GitHub Actions secret masking (the value contains the Docker Hub username) and broke the image build.
- Fixed a docs build bug in the GitBook LanguageSwitcher component (missing `useEffect` import and `mounted` state).

## 1.0.0 (2026-10-20)

- Initial Bansur Router release: local AI routing gateway + web dashboard.
- One OpenAI-compatible endpoint (`/v1/*`) routing across 40+ upstream providers, with format translation, model-combo fallback, and multi-account fallback.
- Dashboard for credential management (OAuth / API key), token refresh, quota and usage tracking, and optional cloud sync.
- CLI launcher (`bansur-router` npm package) with system tray, MITM-assisted integrations for popular AI coding tools, and headless gateway mode.
- Docker images published as `bansur/router` (Docker Hub + GHCR), multi-platform `linux/amd64` + `linux/arm64`.
