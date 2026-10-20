<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**すべての AI プロバイダーに、ひとつのエンドポイントを。**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[クイックスタート](#クイックスタート) · [主な機能](#主な機能) · [プロバイダー](#対応プロバイダー) · [セットアップガイド](#セットアップガイド) · [ドキュメント](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router は、コーディングツールのためのローカル AI ゲートウェイです。自分のマシン上で動作し、接続したすべてのプロバイダーの前面に、単一の OpenAI 互換エンドポイント（`http://localhost:667/v1`）を提供します。

ツールの設定は一度だけです。それ以降、そのエンドポイントの背後にあるプロバイダー接続は Bansur Router が処理します。どのアカウントがリクエストに応答するか、リクエスト形式がどのように変換されるか、クォータがどれだけ残っているか、そしてプロバイダーが拒否したときに何が起こるか。すでに支払っているサブスクリプションが最初に使われ、それが尽きると安価な API が引き継ぎ、チェーンの最後では無料枠がセッションを生かし続けます。

ダッシュボードは `http://localhost:667/dashboard` で動作し、プロバイダーの接続、モデルコンビネーション（コンボ）の構築、使用状況の確認ができます。キーはあなたのマシンに留まり、トラフィックはローカルにルーティングされます。ゲートウェイは、Node.js 上で動作する Next.js アプリとして構築され、npm パッケージと Docker イメージの形で提供されます。

- **ひとつのエンドポイント、ひとつのキー** —— 接続済みのすべてのプロバイダーに、すべてのツールから到達できます
- **800 以上のモデル** —— `GET /v1/models` でライブに一覧表示されます
- **3 段階フォールバック** —— サブスクリプション、次に格安、最後に無料
- **トークン節約を内蔵** —— ツール出力はモデルに届く前に圧縮されます
- **ローカルファースト** —— あなたのキーとトラフィックはあなたのマシンに留まります

現在のリリース：v1.0.5。Node.js 20.9 以降が必要です。

---

## Bansur Router を選ぶ理由

| 問題 | Bansur Router の対処 |
| --- | --- |
| サブスクリプションのクォータが毎月未使用のまま期限切れになる | アカウントごとにクォータを追跡し、リセット前に使い切ります |
| レート制限でコーディングの最中に止められてしまう | 自動でフォールバックします：Subscription → Cheap → Free |
| `git diff`、`grep`、`ls` などのツール出力がトークンを浪費する | RTK でツール結果を圧縮し、リクエストごとにトークンを 20–40% 節約します |
| どのプロバイダーも月額 $20–50 を要求する | 十分な場合は、安価な枠と無料枠へ仕事をルーティングします |
| ツールごとに手作業でプロバイダーを切り替える | すべてのツールにひとつのエンドポイントとひとつのキーを提供し、背後ではマルチアカウントのラウンドロビンを行います |

---

## クイックスタート

### 1. インストールと実行

```bash
npm install -g bansur-router
bansur-router
```

ダッシュボードは `http://localhost:667` で開きます。

### 2. プロバイダーを接続する

**Dashboard → Providers → Connect** を開きます。

始めるのに有料アカウントは必要ありません。**Kiro AI** を接続すれば、Claude 4.5、GLM-5、MiniMax を含む、月約 50 クレジットの無料枠が利用できます。あるいは、認証が一切不要な **OpenCode Free** を接続してください。すでにサブスクリプションや API キーをお持ちの場合は、そちらを接続することもできます（併せて接続することも可能です）。

### 3. ツールを Bansur Router に向ける

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

設定はこれだけです。ツールはこのひとつのエンドポイントを通じて接続済みのすべてのプロバイダーに到達し、各リクエストの行き先は Bansur Router が判断します。

Bansur Router のその他の実行方法（Docker とソースからのビルド）は、[セットアップガイド](#セットアップガイド)で説明しています。

---

## 仕組み

すべてのリクエストは、ツールが送信した形式で到着し、ゲートウェイを通過して、選択されたプロバイダーが期待する形式で出ていきます。

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

フォールバックは自動です。アクティブな層がクォータエラーやレート制限を返したとき、リクエストはエディターで失敗する代わりに、チェーンを下へ移動します。

---

## 主な機能

| 機能 | 説明 |
| --- | --- |
| RTK トークンセーバー | ツール出力（`git diff`、`grep`、`ls` などの結果）をモデルに送る前に圧縮し、リクエストごとにトークンを 20–40% 節約します |
| Headroom トークンセーバー | リクエストのコンテキストに追加の圧縮を適用し、長いセッションが消費するトークンをさらに削減します |
| スマート 3 段階フォールバック | 各リクエストを Subscription → Cheap → Free の順にルーティングし、クォータ枯渇やレート制限の際に層を自動で切り替えます |
| リアルタイムクォータ追跡 | アカウントごとの使用状況とリセットタイミングをライブ表示し、サブスクリプションのクォータが期限切れの後ではなく前に使われるようにします |
| フォーマット変換 | OpenAI、Claude、Gemini のリクエスト形式の間を変換し、ある API 向けに作られたツールが別の API 向けのプロバイダーを使えるようにします |
| マルチアカウント対応 | プロバイダーごとに複数のアカウントを保持し、ラウンドロビンでリクエストを分散します |
| 自動トークンリフレッシュ | OAuth トークンを自動で更新し、接続済みプロバイダーが繰り返しのサインインなしに接続を維持します |
| カスタムコンボ | 異なるプロバイダーや層のモデルを名前付きの組み合わせにグループ化し、ツール内で単一のモデルとして選択できます |
| リクエストログ | リクエストとレスポンスを記録して検査できるようにし、ルーティングやプロバイダーの問題が無言ではなく可視化されるようにします |
| クラウド同期 | マシン間で設定を同期し、2 台目のコンピューターが同じプロバイダーとコンボから始められます |
| 利用状況分析 | プロバイダー、アカウント、モデルごとに、時間経過に伴うトークン使用量を内訳表示します |
| どこでもデプロイ | ローカル、Docker、VPS のいずれでも動作し、どの場合も同じダッシュボードとエンドポイントを提供します |

---

## 対応 CLI ツール

カスタムの OpenAI 互換エンドポイントを受け付けるツールであれば、Bansur Router を利用できます。以下のツールは直接サポートされており、そのほとんどは設定ファイルを手作業で編集する代わりに、ダッシュボードの CLI Tools セクションから設定できます。

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

各ツールについて、設定は同じ 3 つの値です：エンドポイント `http://localhost:667/v1`、ダッシュボードからコピーした API キー、そしてそのツールに使わせたいモデルまたはコンボです。

---

## 対応プロバイダー

接続されたプロバイダーは、ひとつのエンドポイントを通じて 800 以上のモデルを公開します。稼働中のインスタンスに対して `GET /v1/models` を呼び出すと、あなたの接続で利用可能な正確な一覧が得られます。

### OAuth プロバイダー

ダッシュボードからサインインして接続します。Bansur Router はセッションを保存し、そのトークンを自動で更新し、そのクォータを追跡します。

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### 無料プロバイダー

これらの枠の利用に支払いは不要です。そのため、最初のリクエストを成功させる最も速い方法です。

| プロバイダー | 無料枠の内容 |
| --- | --- |
| Kiro AI | 月約 50 クレジットが無料。Claude 4.5、GLM-5、MiniMax を含みます |
| OpenCode Free | 認証なしでアクセスできます |
| Vertex AI | 新規 Google Cloud アカウント向けに $300 分のクレジット |

### API キープロバイダー

40 を超えるプロバイダーが API キーで接続でき、OpenAI 系や Anthropic 系のサービス、さまざまなモデルホストが含まれます。第 2 層として最もよく使われる低コストな選択肢は次のとおりです：

| プロバイダー | 価格 |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### セルフホストプロバイダー

OpenAI 互換形式を話すエンドポイントであれば、どれでもプロバイダーとして接続できます。そのため、自分で提供するモデルも、ホスト型プロバイダーと同じルーティングチェーン（そして同じコンボ）の中に置かれます。

---

## API リファレンス

Bansur Router は、ローカルエンドポイント上に OpenAI 互換 API を公開します。認証には、ダッシュボードに表示される API キーを使用します。

### モデル一覧

```text
GET /v1/models
```

接続したプロバイダー全体で利用可能なすべてのモデルを返します。一般的なプロバイダーを接続すれば、800 以上になります。

### チャット補完の作成

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

リクエストとレスポンスの形式は、OpenAI のチャット補完形式に従います。Bansur Router はそれらを、ルーティングチェーンが選択したプロバイダーのネイティブ形式に変換します。

デフォルトインストールでの主要な URL：

- ダッシュボード：`http://localhost:667/dashboard`
- API ベース：`http://localhost:667/v1`

---

## セットアップガイド

### Docker で実行

このリポジトリのチェックアウトから：

```bash
docker compose up -d
```

公開イメージは、Docker Hub の `bansur/router` および GitHub Container Registry の `ghcr.io/mas-ajam/bansur-router` として入手できます。ダッシュボードと API は、ローカルインストールと同じポート 667 で提供されます。

### ソースから実行

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### プロバイダーを接続する

1. Bansur Router を起動し、`http://localhost:667/dashboard` を開きます。
2. **Providers** に進み、使いたいプロバイダーで **Connect** を選択します。
3. OAuth プロバイダーの場合は、開いたウィンドウでサインインを完了します。API キープロバイダーの場合は、そのプロバイダーが発行したキーを貼り付けます。
4. リクエストを送信します。リクエストがルーティングされるにつれて、プロバイダーのクォータと使用状況がダッシュボードに表示されます。

設定を確認したいだけなら、無料プロバイダーから始めてください：Kiro AI も OpenCode Free も、有料プランなしで動作します。

### コンボを作る

コンボは、選択可能な単一のモデルとして扱われる、順序付けされたモデルのリストです。サブスクリプションのモデルを最初に、格安モデルを 2 番目に、無料モデルを最後に置き、ツールでそのコンボを選択します。最初のモデルが利用できない場合（クォータ枯渇、レート制限、またはエラー）、リクエストは自動的に次の項目へ移動します。

### ポートを変更する

ポート 667 はデフォルトであり、要件ではありません。

```bash
bansur-router --port 8080
```

短い形式の `-p` も使えます。また、`PORT` 環境変数でソース、Docker、サーバーデプロイのポートを設定できます。ポートを変更した場合は、それに合わせてツール内のエンドポイントも更新してください。たとえば `http://localhost:8080/v1` です。ポートを分けることは、すでに 667 を占有している別のローカルサービスと Bansur Router を並行稼働させる最も簡単な方法でもあります。

---

## よくある質問

### Bansur Router とは何ですか？

コーディングツールのためのローカル AI ゲートウェイです。すべての AI プロバイダーの前面に単一の OpenAI 互換エンドポイントを置き、各リクエストを最適な利用可能プロバイダーへルーティングします。そのため、背後でプロバイダー、アカウント、クォータが変わっても、ツールの設定はひとつのままです。

### 無料ですか？

はい。Bansur Router 自体は無料で、MIT ライセンスの下でオープンソースです。リクエストの費用は、ルーティング先のプロバイダーによって決まります：Kiro AI や OpenCode Free のような無料枠は費用がかからず、それ以外については自分のサブスクリプションと API キーを持ち込み、ゲートウェイがない場合とまったく同じように、それらのプロバイダーへ直接支払います。

### データはどこに保存されますか？

あなたのマシン上です。Bansur Router はローカルファーストです：プロバイダーのキーはローカルに保存され、リクエストは自分のインストールからルーティングされ、ゲートウェイの役割はそれらを選択したプロバイダーへ転送することです。最初のリクエストの前に、別途アカウントを作成する必要はありません。

### どのポートを使いますか？

デフォルトは 667 で、ダッシュボードと API の両方に使われます。CLI 起動時の `--port`（または `-p`）、あるいは `PORT` 環境変数で変更できます。

### どのツールで使えますか？

Claude Code、OpenAI Codex、Cursor、Cline、OpenCode、Antigravity、GitHub Copilot、OpenClaw、Continue、RooCode が直接サポートされています。カスタムの OpenAI 互換エンドポイントと API キーを設定できるその他のツールも、同じ 3 つの値で利用できます。

### Windows ユーザーへの注意

グローバル npm パッケージを更新する前に、実行中の Bansur Router インスタンスを停止してください。Windows は実行中のインストールのファイルをロックするため、ゲートウェイがまだ動作している間に更新しようとすると、プロセスを停止するまで失敗します。

---

## トラブルシューティング

### ポートがすでに使用されている

あなたのマシンの何かがすでに 667 をリッスンしています。多くの場合、それはまだ動作している以前の Bansur Router プロセスです。そのプロセスを停止するか、別のポートで起動してツールをそちらに向けます：

```bash
bansur-router --port 8080
```

### プロバイダーの接続に失敗する

ダッシュボードから再接続してください：そのプロバイダーの **Providers → Connect** で、サインインまたはキー入力をもう一度完了します。新しい接続が保存済みのセッションを置き換え、その後は自動トークンリフレッシュが有効な状態を維持します。

### Windows で更新が失敗する

まず実行中のインスタンスを停止し、それから更新を再実行してください。実行中のインストールは Windows 上で自身のプログラムファイルをロックし、グローバル npm パッケージの置き換えを妨げます。

### ポート変更後にリクエストが失敗する

ツールがまだ古いアドレスを指しています。そのエンドポイントを新しいポートに更新し（たとえば `http://localhost:8080/v1`）、API キーが現在実行中のインスタンスのダッシュボードに表示されているものであることを確認してください。

---

## サポート

バグ報告と機能リクエストは、`mas-ajam/bansur-router` リポジトリの [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) からお願いします。実行中のバージョン、Bansur Router の起動方法（npm、Docker、またはソース）、そしてルーティングの問題の場合は関連するリクエストログを含めてください。

完全なドキュメントは [bansur-router.pages.dev](https://bansur-router.pages.dev) にあります。

---

## ライセンス

Bansur Router は [MIT ライセンス](../LICENSE) の下で公開されています。
