# Changelog — Bansur Router

All notable changes to Bansur Router will be documented in this file.

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
