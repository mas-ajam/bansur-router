<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**一个端点，连接所有 AI 提供商。**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[快速开始](#快速开始) · [主要功能](#主要功能) · [提供商](#支持的提供商) · [设置指南](#设置指南) · [文档](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router 是一个面向编程工具的本地 AI 网关。它运行在你自己的机器上，在你连接的每一个提供商之前提供一个统一的、兼容 OpenAI 的端点 —— `http://localhost:667/v1`。

只需配置一次工具。此后，Bansur Router 会在这个端点之后处理提供商连接：由哪个账户响应请求、请求格式如何转换、还剩多少配额，以及当提供商拒绝时该怎么办。你已经付费的订阅会被优先使用；订阅配额耗尽时，由更便宜的 API 接手；免费层级则在链的末端让会话得以持续。

控制台运行在 `http://localhost:667/dashboard`，你可以在那里连接提供商、构建模型组合（combo），并查看用量。密钥保存在你的机器上，流量在本地路由；该网关以 npm 包和 Docker 镜像的形式发布，基于一个运行在 Node.js 上的 Next.js 应用。

- **一个端点，一个密钥** —— 每一个已连接的提供商，都可以从每一个工具访问
- **800+ 模型** —— 通过 `GET /v1/models` 实时列出
- **三级回退** —— 先订阅，再廉价，最后免费
- **内置 Token 节省** —— 工具输出在送达模型之前先行压缩
- **本地优先** —— 你的密钥和流量始终留在你的机器上

当前版本：v1.0.5。需要 Node.js 20.9 或更高版本。

---

## 为什么选择 Bansur Router

| 问题 | Bansur Router 的做法 |
| --- | --- |
| 订阅配额每月到期却从未用完 | 按账户跟踪配额，在重置前把它用掉 |
| 速率限制在编程中途打断你 | 自动回退：Subscription → Cheap → Free |
| `git diff`、`grep`、`ls` 等工具输出大量消耗 tokens | 用 RTK 压缩工具结果，每次请求节省 20–40% 的 tokens |
| 每个提供商每月都要 $20–50 | 在足够用时，将工作路由到廉价和免费层级 |
| 为每个工具分别手动切换提供商 | 为每个工具提供一个端点和一个密钥，背后是多账户轮询 |

---

## 快速开始

### 1. 安装并运行

```bash
npm install -g bansur-router
bansur-router
```

控制台会在 `http://localhost:667` 打开。

### 2. 连接一个提供商

打开 **Dashboard → Providers → Connect**。

开始使用不需要付费账户。连接 **Kiro AI**，可获得每月约 50 点额度的免费层级，其中包含 Claude 4.5、GLM-5 和 MiniMax；或者连接 **OpenCode Free**，它完全不需要身份验证。如果你已经有订阅或 API 密钥，也可以连接那些 —— 单独连接，或一并连接。

### 3. 将你的工具指向 Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

设置到此为止。你的工具现在通过这一个端点访问每一个已连接的提供商，由 Bansur Router 决定每个请求发往何处。

运行 Bansur Router 的其他方式 —— Docker 和从源码构建 —— 见[设置指南](#设置指南)。

---

## 工作原理

每个请求以你的工具发送的格式到达，穿过网关，再以所选提供商期望的格式离开。

```text
Your CLI tool
  Claude Code, Codex, Cursor, Cline, ...
        |
        |  http://localhost:667/v1
        v
Bansur Router
  - RTK token saver (compress tool results)
  - Format translation (OpenAI <-> Claude <-> Gemini)
  - Quota tracking per account
  - Automatic OAuth token refresh
        |
        +--> Tier 1: SUBSCRIPTION
        |    Claude Code, Codex, GitHub Copilot
        |    (used first, while quota lasts)
        |
        +--> Tier 2: CHEAP
        |    GLM ($0.6 / 1M tokens), MiniMax ($0.20 / 1M tokens)
        |    (takes over when subscription quota runs out)
        |
        +--> Tier 3: FREE
             Kiro, OpenCode Free, Vertex AI ($300 credits
             for new Google Cloud accounts)
             (keeps the session running at no cost)
```

回退是自动的。当当前层级返回配额错误或速率限制时，请求会沿着链向下移动，而不是在你的编辑器里失败。

---

## 主要功能

| 功能 | 作用 |
| --- | --- |
| RTK Token 节省器 | 在工具输出 —— `git diff`、`grep`、`ls` 等结果 —— 发送给模型之前先行压缩，每次请求节省 20–40% 的 tokens |
| Headroom Token 节省器 | 对请求上下文施加额外压缩，进一步减少长会话消耗的 tokens |
| 智能三级回退 | 按 Subscription → Cheap → Free 路由每个请求，在配额耗尽或速率限制时自动切换层级 |
| 实时配额追踪 | 显示每个账户的实时用量和重置时间，让订阅配额在过期之前、而不是之后被用掉 |
| 格式转换 | 在 OpenAI、Claude 和 Gemini 的请求格式之间互相转换，使为一种 API 构建的工具可以使用为另一种 API 构建的提供商 |
| 多账户支持 | 每个提供商可以保存多个账户，并通过轮询路由在它们之间分发请求 |
| 自动 Token 刷新 | 自动刷新 OAuth tokens，使已连接的提供商无需反复登录即可保持连接 |
| 自定义组合 | 将来自不同提供商和层级的模型分组为命名的组合，在你的工具中作为单个模型来选择 |
| 请求日志 | 记录请求与响应以便检查，让路由和提供商的问题变得可见，而不是无声无息 |
| 云同步 | 在多台机器之间同步你的配置，使第二台电脑从相同的提供商和组合起步 |
| 使用分析 | 按提供商、账户和模型，细分一段时间内的 token 用量 |
| 随处部署 | 可在本地、Docker 或 VPS 上运行，每种情况下都是相同的控制台和端点 |

---

## 支持的 CLI 工具

任何接受自定义的、兼容 OpenAI 的端点的工具都可以使用 Bansur Router。以下工具得到直接支持，而且其中大多数可以从控制台的 CLI Tools 部分进行配置，无需手动编辑配置文件。

- Claude Code
- OpenAI Codex
- Cursor
- Cline
- OpenCode
- Antigravity
- GitHub Copilot
- OpenClaw
- Continue
- RooCode

对每个工具，配置都是同样的三个值：端点 `http://localhost:667/v1`、从控制台复制的 API 密钥，以及你希望该工具使用的模型或组合。

---

## 支持的提供商

已连接的提供商通过一个端点暴露 800 多个模型。对正在运行的实例调用 `GET /v1/models`，即可获得你的连接可用的确切列表。

### OAuth 提供商

通过控制台登录即可连接。Bansur Router 会保存会话、自动刷新其 tokens，并跟踪其配额。

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### 免费提供商

使用这些层级无需付费，这使它们成为完成第一个请求的快捷方式。

| 提供商 | 免费层级提供什么 |
| --- | --- |
| Kiro AI | 每月约 50 点额度免费，包括 Claude 4.5、GLM-5 和 MiniMax |
| OpenCode Free | 无需身份验证即可访问 |
| Vertex AI | 新 Google Cloud 账户可获得 $300 额度 |

### API 密钥提供商

超过 40 个提供商可使用 API 密钥连接，包括 OpenAI 与 Anthropic 风格的服务以及众多模型托管商。最常用作第二层级的低成本选项是：

| 提供商 | 价格 |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### 自托管提供商

任何使用 OpenAI 兼容格式的端点都可以连接为提供商，因此你自己托管的模型与托管提供商处于同一条路由链 —— 以及同样的组合 —— 之中。

---

## API 参考

Bansur Router 在其本地端点上暴露一个兼容 OpenAI 的 API。使用控制台中显示的 API 密钥进行身份验证。

### 列出模型

```text
GET /v1/models
```

返回你的所有已连接提供商可用的每一个模型 —— 连接常见提供商后，模型数量超过 800 个。

### 创建聊天补全

```text
POST /v1/chat/completions
Authorization: Bearer <dashboard API key>
```

```bash
curl http://localhost:667/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [
      { "role": "user", "content": "Explain what this function does." }
    ]
  }'
```

请求和响应的结构遵循 OpenAI 聊天补全格式。Bansur Router 会将它们转换为路由链所选提供商的原生格式。

默认安装的关键 URL：

- 控制台：`http://localhost:667/dashboard`
- API 基础地址：`http://localhost:667/v1`

---

## 设置指南

### 使用 Docker 运行

从本仓库的一个检出（checkout）中执行：

```bash
docker compose up -d
```

发布的镜像可在 Docker Hub 上以 `bansur/router` 获取，也可在 GitHub Container Registry 上以 `ghcr.io/mas-ajam/bansur-router` 获取。控制台和 API 在 667 端口提供服务，与本地安装相同。

### 从源码运行

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### 连接提供商

1. 启动 Bansur Router 并打开 `http://localhost:667/dashboard`。
2. 进入 **Providers**，在你想用的提供商上选择 **Connect**。
3. 对于 OAuth 提供商，在打开的窗口中完成登录；对于 API 密钥提供商，粘贴该提供商签发的密钥。
4. 发送一个请求。随着请求被路由，提供商的配额和用量会出现在控制台中。

如果你只是想验证设置，从一个免费提供商开始：Kiro AI 或 OpenCode Free 都无需付费计划即可使用。

### 构建组合

组合是一个被当作单个可选模型的有序模型列表。将你的订阅模型放在第一位，廉价模型放在第二位，免费模型放在最后，然后在你的工具中选择该组合。当第一个模型不可用时 —— 配额耗尽、被速率限制或出错 —— 请求会自动移动到下一个条目。

### 更改端口

667 是默认端口，而非强制要求。

```bash
bansur-router --port 8080
```

短形式 `-p` 同样可用，`PORT` 环境变量可以为源码、Docker 和服务器部署设置端口。如果你更改了端口，请相应更新工具中的端点，例如 `http://localhost:8080/v1`。分离端口也是让 Bansur Router 与另一个已经占用 667 的本地服务并行运行的最简单方法。

---

## 常见问题

### 什么是 Bansur Router？

一个面向编程工具的本地 AI 网关。它在你的所有 AI 提供商之前放置一个兼容 OpenAI 的端点，并将每个请求路由到最佳的可用提供商，这样你的工具保持单一配置，而提供商、账户和配额在其背后变化。

### 它是免费的吗？

是的。Bansur Router 本身免费，并依据 MIT 许可证开源。一个请求的费用取决于它被路由到的提供商：Kiro AI 和 OpenCode Free 等免费层级不收取任何费用；其余的则由你自带订阅和 API 密钥，直接向那些提供商付费，与没有网关时完全一样。

### 我的数据存放在哪里？

在你的机器上。Bansur Router 本地优先：提供商密钥保存在本地，请求从你自己的安装中路由，网关的工作就是将它们转发到你选择的提供商。在发出第一个请求之前，无需创建任何单独的账户。

### 它使用哪个端口？

默认是 667，控制台和 API 都使用它。启动 CLI 时可用 `--port`（或 `-p`）更改，也可使用 `PORT` 环境变量。

### 它适用于哪些工具？

Claude Code、OpenAI Codex、Cursor、Cline、OpenCode、Antigravity、GitHub Copilot、OpenClaw、Continue 和 RooCode 得到直接支持。任何其他允许你设置自定义的、兼容 OpenAI 的端点和 API 密钥的工具，都可以使用同样的三个值。

### 给 Windows 用户的说明

在更新全局 npm 包之前，先停止正在运行的 Bansur Router 实例。Windows 会锁定正在运行的安装的文件，因此在网关仍在运行时尝试更新会失败，直到进程被停止。

---

## 故障排除

### 端口已被占用

你的机器上已有东西在监听 667，通常是一个仍在运行的、较早的 Bansur Router 进程。停止该进程，或者在另一个端口启动，并让你的工具指向它：

```bash
bansur-router --port 8080
```

### 提供商连接失败

从控制台重新连接它：进入该提供商的 **Providers → Connect**，重新完成登录或密钥输入。新连接会替换已保存的会话，此后自动 token 刷新会保持其有效。

### 在 Windows 上更新失败

先停止正在运行的实例，然后重新运行更新。正在运行的安装会在 Windows 上锁定自己的程序文件，从而阻止全局 npm 包被替换。

### 更改端口后请求失败

你的工具仍在指向旧地址。将其端点更新到新端口 —— 例如 `http://localhost:8080/v1` —— 并确认 API 密钥是当前运行实例的控制台中显示的那个。

---

## 支持

通过 `mas-ajam/bansur-router` 仓库上的 [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) 报告缺陷和请求功能。请附上你正在运行的版本、Bansur Router 的启动方式（npm、Docker 或源码），以及在涉及路由问题时的相关请求日志。

完整文档位于 [bansur-router.pages.dev](https://bansur-router.pages.dev)。

---

## 许可证

Bansur Router 依据 [MIT 许可证](../LICENSE) 发布。
