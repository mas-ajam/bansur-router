# Changelog — Bansur Router

All notable changes to Bansur Router will be documented in this file.

## 1.0.8 (2026-10-21)

- **Dashboard rebuilt to full design parity.** Every screen was audited value-by-value against the approved design (192 checkpoints) and rebuilt to match it exactly: design tokens and primitives (fields, buttons, badges, toasts), a five-group sidebar with a real Overview as the home screen, a light request table replacing the Console Log terminal, Usage as a single 7-day page with the design's chart and tables, Combos and Translator in their two-pane forms, Media Providers as one page with a working Web test panel, and Profile and Settings as separate screens. Surfaces the design does not define were removed rather than restyled — including the dark theme, the Donate button, the language switcher, and the 9Remote/9English sidebar entries.
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
