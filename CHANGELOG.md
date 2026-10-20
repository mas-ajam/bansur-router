# Changelog — Bansur Router

All notable changes to Bansur Router will be documented in this file.

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
