<div align="center">
  <img src="https://raw.githubusercontent.com/mas-ajam/bansur-router/main/images/banner.png" alt="Bansur Router" width="700"/>
</div>

# Bansur Router

**One endpoint for every AI provider.**

Bansur Router is a local AI gateway for coding tools. It presents a single OpenAI-compatible endpoint — `http://localhost:667/v1` — in front of every provider you connect to it: Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, and 40+ providers with 800+ models behind them.

Configure your tool once. Subscriptions you already pay for are used first, cheaper APIs take over when they run out, and free tiers keep the session alive at the end of the chain.

## Quick start

From a checkout of the repository:

```bash
docker compose up -d
```

Or run the published image directly:

```bash
docker run -d \
  --name bansur-router \
  -p 667:667 \
  -v "$HOME/.bansur-router:/app/data" \
  -e DATA_DIR=/app/data \
  bansur/router:latest
```

The same image is also published to the GitHub Container Registry:

```bash
docker pull ghcr.io/mas-ajam/bansur-router:latest
```

Multi-platform image: `linux/amd64` + `linux/arm64`.

Then open the dashboard at **http://localhost:667**, connect a provider, and point your tools at `http://localhost:667/v1` with the API key shown in the dashboard.

## Why Bansur Router?

| Problem | What Bansur Router does |
| --- | --- |
| Subscription quota expires unused every month | Tracks quota per account and spends it before it resets |
| A rate limit stops you in the middle of a coding session | Falls back automatically: Subscription → Cheap → Free |
| Tool outputs such as `git diff`, `grep`, and `ls` burn tokens | Compresses tool results with RTK, saving 20–40% of tokens per request |
| Every provider wants $20–50 per month | Routes work to cheap and free tiers when they are good enough |
| Switching providers by hand, separately for each tool | Gives every tool one endpoint and one key, with multi-account round-robin behind it |

## Key features

- **RTK Token Saver** — compresses tool outputs before they reach the model, saving 20–40% of tokens per request
- **Smart 3-Tier Fallback** — Subscription → Cheap → Free, switching automatically on quota exhaustion or rate limits
- **Real-Time Quota Tracking** — live usage and reset timing per account
- **Format Translation** — between OpenAI, Claude, and Gemini request formats
- **Multi-Account Support** — several accounts per provider, distributed round-robin
- **Auto Token Refresh** — OAuth tokens refresh themselves, so providers stay connected
- **Custom Combos** — named model combinations spanning providers and tiers
- **Request Logging & Usage Analytics** — see exactly what was routed where
- **Cloud Sync** — the same configuration on every machine
- **Dashboard** — provider connections (OAuth / API key), quota and usage, all on port 667

## Other install options

- **npm:** `npm install -g bansur-router` — https://www.npmjs.com/package/bansur-router
- **Docker Hub:** `docker pull bansur/router:latest`
- **GHCR:** `docker pull ghcr.io/mas-ajam/bansur-router:latest`

## Links

- Documentation: https://bansur-router.pages.dev
- Source & issues: https://github.com/mas-ajam/bansur-router
- npm package: https://www.npmjs.com/package/bansur-router

## License

MIT
