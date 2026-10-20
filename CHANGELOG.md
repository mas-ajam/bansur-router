# Changelog — Bansur Router

All notable changes to Bansur Router will be documented in this file.

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
