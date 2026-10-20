<div align="center">

<img src="https://raw.githubusercontent.com/mas-ajam/bansur-router/main/images/banner.png" alt="Bansur Router" width="700"/>

**One endpoint for every AI provider.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Quick Start](#quick-start) · [CLI Options](#cli-options) · [Key Features](#key-features) · [Documentation](https://bansur-router.pages.dev)

</div>

---

# Bansur Router

Bansur Router is a local AI gateway for coding tools. It runs on your own machine and presents a single OpenAI-compatible endpoint — `http://localhost:667/v1` — in front of every provider you connect to it.

This package installs the `bansur-router` command, which starts the gateway and its dashboard. Configure your tool once. From then on, Bansur Router handles the provider connections behind that endpoint: which account answers a request, how the request format is translated, how much quota is left, and what happens when a provider says no. Subscriptions you already pay for are used first, cheaper APIs take over when they run out, and free tiers keep the session alive at the end of the chain.

- **One endpoint, one key** — every connected provider, reachable from every tool
- **800+ models** — listed live through `GET /v1/models`
- **3-tier fallback** — Subscription, then Cheap, then Free
- **Token saving built in** — tool outputs are compressed before they reach the model
- **Local-first** — your keys and your traffic stay on your machine

Current release: v1.0.5. Requires Node.js 20.9 or later.

---

## Why Bansur Router

| Problem | What Bansur Router does |
| --- | --- |
| Subscription quota expires unused every month | Tracks quota per account and spends it before it resets |
| A rate limit stops you in the middle of a coding session | Falls back automatically: Subscription → Cheap → Free |
| Tool outputs such as `git diff`, `grep`, and `ls` burn tokens | Compresses tool results with RTK, saving 20–40% of tokens per request |
| Every provider wants $20–50 per month | Routes work to cheap and free tiers when they are good enough |
| Switching providers by hand, separately for each tool | Gives every tool one endpoint and one key, with multi-account round-robin behind it |

---

## Quick Start

### 1. Install and run

**Option 1 — npm (recommended for desktop):**

```bash
npm install -g bansur-router
bansur-router

# Or run directly with npx
npx bansur-router
```

**Option 2 — Docker (server/VPS):**

```bash
docker run -d --name bansur-router -p 667:667 \
  -v "$HOME/.bansur-router:/app/data" -e DATA_DIR=/app/data \
  bansur/router:latest
```

Published images: [Docker Hub](https://hub.docker.com/r/bansur/router) • [GHCR](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router) (multi-platform amd64/arm64).

The dashboard opens at `http://localhost:667`.

### 2. Connect a provider

Open **Dashboard → Providers → Connect**.

You do not need a paid account to start. Connect **Kiro AI** for a free tier of about 50 credits per month, which includes Claude 4.5, GLM-5, and MiniMax, or connect **OpenCode Free**, which needs no authentication at all. If you already have subscriptions or API keys, connect those instead — or as well.

### 3. Point your tool at Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

That is the whole setup. The tool now reaches every connected provider through the one endpoint, and Bansur Router decides where each request goes.

---

## CLI Options

```bash
bansur-router                    # Start with default settings
bansur-router --port 8080        # Custom port
bansur-router --no-browser       # Don't open browser
bansur-router --skip-update      # Skip auto-update check
bansur-router --help             # Show all options
```

**Dashboard**: `http://localhost:667/dashboard`

---

## Connect to a Remote Bansur Router

Already running Bansur Router on another machine (e.g. a team server on your LAN)? Point this machine's CLI tools at it — no local server is started:

```bash
npx bansur-router connect http://<server-host>:667                       # pick tools interactively
npx bansur-router connect http://<server-host>:667 --tools claude,codex  # or choose up front
npx bansur-router connect --reset --tools claude,codex                     # undo
```

It logs in with the dashboard password (hidden prompt), reuses or creates an API key named `cli-<hostname>`, and writes each tool's config (backing up the original once as `*.bak-bansur-router`).

Supported tools: `claude`, `codex`, `opencode`, `droid`, `crush`, `kilo`, `cline`, `pi`, `omp`, or `all`.

### Models

Models come from the **server's own CLI-tools configuration**, so a client gets whatever the operator already picked on the dashboard. Nothing is hardcoded.

| Tool | Model taken from (first match wins) |
|---|---|
| `claude` | tier flag (`--opus` …) → server's Claude tier → *left unset* (Claude Code's own default) |
| others | `--model` → that tool's own model on the server → server's OpenCode model → *tool skipped* |

`kilo` has no readable model on the server, so it always uses `--model` or the OpenCode model. `omp` (Oh My Pi) needs no model: it uses proxy discovery, so every server model appears under `bansur-router` in `/model`. A Claude tier the server doesn't set is removed from your config rather than kept from an earlier run. A skipped tool makes the command exit `1`.

### Overriding the server's models

```bash
# One Claude tier; the other tiers still come from the server
npx bansur-router connect http://<server-host>:667 --tools claude --sonnet cc/claude-sonnet-5-5

# Every Claude tier
npx bansur-router connect http://<server-host>:667 --tools claude \
  --fable cc/claude-fable-5-1 --opus cc/claude-opus-5-5 \
  --sonnet cc/claude-sonnet-5-5 --haiku cc/claude-haiku-4-5-20251001

# All non-Claude tools at once
npx bansur-router connect http://<server-host>:667 --tools codex,opencode,kilo --model ocg/deepseek-flash

# Claude and other tools in one run
npx bansur-router connect http://<server-host>:667 --tools claude,codex --opus cc/claude-opus-5-5 --model gpt-6

# A different model per tool: --model covers every non-Claude tool in a run, so run once per tool
npx bansur-router connect http://<server-host>:667 --tools codex --model gpt-6
npx bansur-router connect http://<server-host>:667 --tools opencode --model ocg/glm-5.3
```

A model the server doesn't list is still written, with a `not listed by server` warning. To see the ids it serves: `curl http://<server-host>:667/v1/models -H "Authorization: Bearer <your key>"`.

### Checking the current config

`bansur-router show` prints what each CLI tool on this machine is currently set to — base URL, masked API key and models. It only reads local files and never contacts a server.

```bash
npx bansur-router show                 # every supported tool
npx bansur-router show claude          # one tool
npx bansur-router show claude codex    # several
npx bansur-router show claude --json   # machine-readable (key still masked)
```

```
✅ Claude Code
   File:     ~/.claude/settings.json
   Base URL: http://<server-host>:667/v1
   API key:  sk-a1b…9f3c
   Models:
     fable   cc/claude-fable-5-1
     opus    cc/claude-opus-5-5
     sonnet  cc/claude-sonnet-5-5
```

Tools not pointed at bansur-router are listed as `not configured`. For Codex, OpenCode and Cline it also warns when a bansur-router entry exists but another provider is the active one.

### Other options

| Option | Purpose |
|---|---|
| `--password <pw>` | Dashboard password (or `BANSUR_ROUTER_PASSWORD`); prompted if omitted — preferred, keeps it out of shell history |
| `--save` | After a successful login, save the password for this server to `~/.bansur-router/connect.env` (plain text, mode 600) so later runs skip the prompt. Delete the file to forget it |
| `--api-key <key>` | Use this key and skip login. The server's models can't be read without a login, so pass model flags |
| `--key-name <name>` | API key name to reuse/create (default `cli-<hostname>`) |
| `--print-env` | Also print `OPENAI_BASE_URL` / `OPENAI_API_KEY` for other CLIs |
| `--reset` | Remove the bansur-router settings from the selected tools |

See `bansur-router connect --help` for the full list.

> ⚠️ Over plain `http://` the password and API key are sent unencrypted — use a trusted LAN/VPN or put HTTPS in front. The API key is stored in each tool's config file.

---

## Key Features

| Feature | What it does |
| --- | --- |
| RTK Token Saver | Compresses tool outputs — `git diff`, `grep`, `ls`, and similar results — before they are sent to the model, saving 20–40% of tokens per request |
| Headroom Token Saver | Applies additional compression to request context, further reducing the tokens a long session consumes |
| Smart 3-Tier Fallback | Routes each request Subscription → Cheap → Free, switching tiers automatically on quota exhaustion or rate limits |
| Real-Time Quota Tracking | Shows live usage and reset timing per account, so subscription quota is spent before it expires instead of after |
| Format Translation | Translates between OpenAI, Claude, and Gemini request formats, so a tool built for one API can use providers built for another |
| Multi-Account Support | Holds several accounts per provider and distributes requests across them with round-robin routing |
| Auto Token Refresh | Refreshes OAuth tokens automatically, so connected providers stay connected without repeated sign-ins |
| Custom Combos | Groups models from different providers and tiers into named combinations you select as a single model in your tool |
| Request Logging | Records requests and responses for inspection, which makes routing and provider problems visible instead of silent |
| Cloud Sync | Synchronizes your configuration across machines, so a second computer starts from the same providers and combos |
| Usage Analytics | Breaks down token usage over time by provider, account, and model |
| Deploy Anywhere | Runs locally, in Docker, or on a VPS, with the same dashboard and endpoint in each case |

---

## Supported CLI Tools

Claude-Code • OpenClaw • Codex • OpenCode • Cursor • Antigravity • Cline • Continue • Droid • Roo • Copilot • Kilo Code • Gemini CLI • Qwen Code • iFlow • Crush • Crusher • Aider

Any tool supporting OpenAI/Claude-compatible API works.

---

## Data Location

- **macOS/Linux**: `~/.bansur-router/db/data.sqlite`
- **Windows**: `%APPDATA%/bansur-router/db/data.sqlite`
- **Docker**: `/app/data/db/data.sqlite` (mount `$HOME/.bansur-router` to persist)

---

## Documentation

Full docs, advanced setup, video tutorials & development guide:

- **GitHub**: https://github.com/mas-ajam/bansur-router
- **Full README**: https://github.com/mas-ajam/bansur-router/blob/master/README.md
- **Website**: https://bansur-router.pages.dev

---

## License

MIT License - see [LICENSE](LICENSE) for details.
