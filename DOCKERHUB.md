<div align="center">
  <img src="https://raw.githubusercontent.com/mas-ajam/bansur-router/main/images/bansur-router.png" alt="Bansur Router" width="700"/>
</div>

# Bansur Router

**FREE AI Router & Token Saver** — never stop coding. Save 20–40% tokens with RTK compression and auto-fallback to free & cheap AI models.

Connect all your AI coding tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw…) to **40+ AI providers & 100+ models** through one OpenAI-compatible endpoint.

## Quick start

```bash
docker run -d \
  --name bansur-router \
  -p 20128:20128 \
  -v "$HOME/.bansur-router:/app/data" \
  -e DATA_DIR=/app/data \
  bansur/router:latest
```

Then open the dashboard at **http://localhost:20128** and point your tools at `http://localhost:20128/v1`.

Multi-platform image: `linux/amd64` + `linux/arm64`.

## Why Bansur Router?

- ✅ **RTK Token Saver** — auto-compresses tool results, saving 20–40% tokens per request
- ✅ **Maximize subscriptions** — tracks quota so nothing expires unused
- ✅ **Auto fallback** — subscription → cheap → free, zero downtime
- ✅ **Multi-account** — round-robin between accounts per provider
- ✅ **Universal** — works with Claude Code, Codex, Cursor, Cline, and any OpenAI-compatible CLI tool
- ✅ **Dashboard** — credential management (OAuth / API key), token refresh, quota & usage tracking, optional cloud sync

## Other install options

- **npm:** `npm install -g bansur-router` — https://www.npmjs.com/package/bansur-router
- **GHCR:** `docker pull ghcr.io/mas-ajam/bansur-router:latest`

## Links

- 📖 Documentation: https://bansur-router.pages.dev
- 💻 Source & issues: https://github.com/mas-ajam/bansur-router
- 📦 npm package: https://www.npmjs.com/package/bansur-router

## License

MIT
