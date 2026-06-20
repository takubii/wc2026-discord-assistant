# Setup

このドキュメントは、WC2026 Discord Assistantを使う人向けの最短手順と、共有Botを運用する人向けの設定概要です。

## 利用者向け

共有Botとして運用されている場合、利用者がCloudflareやGitHubを触る必要はありません。

1. Bot招待URLを開く
2. 自分のDiscordサーバーへ追加する
3. サーバー内で投稿先を設定する

```text
/wc setup channels schedule:#試合日程 results:#結果 lineup:#スタメン
```

設定確認:

```text
/wc setup status
```

毎日通知を止める:

```text
/wc setup daily enabled:false
```

開始前スタメン通知を止める:

```text
/wc setup lineup enabled:false
```

`/wc setup` はサーバー管理権限を持つユーザーだけ実行できます。

## 運用者向け

共有Botを自分のCloudflareで運用する場合に必要です。

- GitHubリポジトリ
- Discord Application
- Cloudflareアカウント
- Node.js

API-FootballのAPI keyは使いません。

## Discord Application

Slash CommandとBot投稿用です。

1. Discord Developer PortalでApplicationを作る
2. `General Information` で `APPLICATION ID` と `PUBLIC KEY` を控える
3. `Bot` でBot Tokenを作る
4. `OAuth2` のURL Generatorで `bot` と `applications.commands` を選ぶ
5. Bot権限で `View Channels` と `Send Messages` を選ぶ
6. 生成されたURLから対象サーバーへインストールする

共有Botとして他のサーバーに入れてもらう場合も、この招待URLを使います。

Bot TokenはWorker SecretとSlash Command登録に使います。Botを常駐させる必要はありません。

## Cloudflare Worker

Slash Commandの受け口と、毎日16:00 JSTの自動投稿を担当します。

1. Cloudflareにログインする
2. このリポジトリで `npm install` を実行する
3. `npx wrangler login` を実行する
4. `npx wrangler kv namespace create LINEUP_POSTS` でKV namespaceを作り、表示された `id` を `wrangler.toml` の `LINEUP_POSTS` に設定する
5. `npx wrangler d1 create wc2026-discord-assistant` でD1 databaseを作り、表示された `database_id` を `wrangler.toml` の `DB` に設定する
6. `npx wrangler d1 migrations apply wc2026-discord-assistant --remote` でテーブルを作成する
7. Worker Secretを設定する
8. `npm run deploy` でWorkerをデプロイする

```powershell
npx wrangler kv namespace create LINEUP_POSTS
npx wrangler d1 create wc2026-discord-assistant
npx wrangler d1 migrations apply wc2026-discord-assistant --remote
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

`GEMINI_API_KEY` はラインナップ画像の配置が崩れそうな場合だけ使います。未設定でも通常のルールベース配置で動きます。

デプロイ後に表示されるWorker URLをDiscord Applicationの `Interactions Endpoint URL` に設定します。

## 自動投稿

自動投稿は `wrangler.toml` のCron Triggerで設定しています。

```toml
[triggers]
crons = ["*/5 * * * *", "0 7 * * *"]
```

Cloudflare CronはUTC基準なので、`0 7 * * *` は毎日16:00 JSTです。16:00に今日の結果を結果チャンネルへ投稿し、その後に明日の試合予定を試合日程チャンネルへ投稿します。

`*/5 * * * *` は5分おきに直近16分以内に始まる試合を確認し、公式スタメンが取れた場合だけ文字版スタメンを投稿します。重複投稿はKV namespace `LINEUP_POSTS` で防ぎます。

## Slash Command登録

PowerShellで以下を実行します。

```powershell
$env:DISCORD_APPLICATION_ID="Discord Application ID"
$env:DISCORD_BOT_TOKEN="Discord Bot Token"
$env:DISCORD_GUILD_ID="Discord Server ID"
npm run register:commands
```

`DISCORD_GUILD_ID` を指定すると、そのサーバーだけに即時反映されます。指定しない場合はグローバルコマンドになり、反映に時間がかかることがあります。

共有Botとして配布する場合は、動作確認後に `DISCORD_GUILD_ID` を外してグローバル登録します。

## 旧Webhook構成

Webhookは互換用です。D1にサーバー設定が1件もない場合だけ、Cloudflare Worker SecretのWebhook URLへフォールバック投稿します。

```powershell
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put DISCORD_RESULTS_WEBHOOK_URL
npx wrangler secret put DISCORD_LINEUP_WEBHOOK_URL
```

`DISCORD_WEBHOOK_URL` は試合日程チャンネル、`DISCORD_RESULTS_WEBHOOK_URL` は結果チャンネルのWebhook URLを設定します。`DISCORD_LINEUP_WEBHOOK_URL` は開始前スタメン通知用です。未設定の場合、開始前スタメン通知は `DISCORD_WEBHOOK_URL` へ投稿されます。

## Public化前の確認

以下は公開しないでください。

- Discord Webhook URL
- Discord Bot Token
- Discord Public Key
- Cloudflare API token
- GitHub token
- `.env`
- `.wrangler`

公開前に最低限以下を確認します。

```powershell
rg -n "discord.com/api/webhooks|DISCORD_BOT_TOKEN|API_FOOTBALL|BEGIN PRIVATE KEY|SECRET|TOKEN" . -S -g '!node_modules' -g '!.git'
git status --short
```

実値が見つかった場合は、ファイルから消すだけでなく、必要に応じてgit履歴からも削除します。
