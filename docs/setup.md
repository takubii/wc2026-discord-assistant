# Setup

このドキュメントは、WC2026 Discord Assistantを動かすために用意するものと、各サービスで行う設定の概要です。

## 用意するもの

- GitHubリポジトリ
- Discordサーバー
- Discord投稿先チャンネル
- Discord Webhook URL
- Discord Application
- Cloudflareアカウント
- Node.js

API-FootballのAPI keyは使いません。

## Discord Webhook

Cloudflare Worker Cron Triggerの自動投稿に使います。

1. Discordで投稿先チャンネルを決める
2. サーバー設定を開く
3. `Integrations` でWebhookを作成する
4. 投稿先チャンネルを選ぶ
5. Webhook URLをコピーする

コピーしたURLはCloudflare Worker Secretに入れます。コードには書きません。

## GitHub

1. リポジトリを作る
2. このコードをpushする

GitHub Actionsには手動確認用workflowだけを残しています。

- `Post World Cup Matches`: 手動で翌日の試合予定を投稿、またはdry run
- `Post World Cup Results Summary`: 手動で今日の結果を投稿、またはdry run

手動テストはActions画面の `Run workflow` から実行できます。`dry_run` を `true` にするとDiscordへ投稿せず、Actionsログに本文だけ出します。手動投稿にも使う場合は、GitHub Actions Secretにも `DISCORD_WEBHOOK_URL` と `DISCORD_RESULTS_WEBHOOK_URL` を設定してください。

## Discord Application

Slash Command用です。

1. Discord Developer PortalでApplicationを作る
2. `General Information` で `APPLICATION ID` と `PUBLIC KEY` を控える
3. `Bot` でBot Tokenを作る
4. `OAuth2` のURL Generatorで `applications.commands` を選ぶ
5. 生成されたURLから対象サーバーへインストールする

Bot Tokenはコマンド登録にだけ使います。Botを常駐させる必要はありません。

`/wc lineup` は文字で公式スタメンを表示します。画像付きで確認したい場合は `/wc lineup image:true` を使います。

## Cloudflare Worker

Slash Commandの受け口と、毎日16:00 JSTの自動投稿を担当します。

1. Cloudflareにログインする
2. このリポジトリで `npm install` を実行する
3. `npx wrangler login` を実行する
4. `npx wrangler kv namespace create LINEUP_POSTS` でKV namespaceを作り、表示された `id` を `wrangler.toml` の `LINEUP_POSTS` に設定する
5. `npm run deploy` でWorkerをデプロイする
6. `DISCORD_PUBLIC_KEY` をWorker Secretに入れる
7. `DISCORD_WEBHOOK_URL` をWorker Secretに入れる
8. `DISCORD_RESULTS_WEBHOOK_URL` をWorker Secretに入れる
9. 任意で `DISCORD_LINEUP_WEBHOOK_URL` をWorker Secretに入れる
10. 任意で `GEMINI_API_KEY` をWorker Secretに入れる

```powershell
npx wrangler kv namespace create LINEUP_POSTS
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put DISCORD_RESULTS_WEBHOOK_URL
npx wrangler secret put DISCORD_LINEUP_WEBHOOK_URL
npx wrangler secret put GEMINI_API_KEY
```

`DISCORD_WEBHOOK_URL` は試合日程チャンネル、`DISCORD_RESULTS_WEBHOOK_URL` は結果チャンネルのWebhook URLを設定します。`DISCORD_LINEUP_WEBHOOK_URL` は開始前スタメン通知用です。未設定の場合、開始前スタメン通知は `DISCORD_WEBHOOK_URL` へ投稿されます。

`GEMINI_API_KEY` はラインナップ画像の配置が崩れそうな場合だけ使います。未設定でも通常のルールベース配置で動きます。

デプロイ後に表示されるWorker URLをDiscord Applicationの `Interactions Endpoint URL` に設定します。

自動投稿は `wrangler.toml` のCron Triggerで設定しています。

```toml
[triggers]
crons = ["*/5 * * * *", "0 7 * * *"]
```

Cloudflare CronはUTC基準なので、`0 7 * * *` は毎日16:00 JSTです。16:00に今日の結果を結果チャンネルへ投稿し、その後に明日の試合予定を試合日程チャンネルへ投稿します。`*/5 * * * *` は5分おきに直近16分以内に始まる試合を確認し、公式スタメンが取れた場合だけ文字版スタメンを投稿します。重複投稿はKV namespace `LINEUP_POSTS` で防ぎます。

## Slash Command登録

PowerShellで以下を実行します。

```powershell
$env:DISCORD_APPLICATION_ID="Discord Application ID"
$env:DISCORD_BOT_TOKEN="Discord Bot Token"
$env:DISCORD_GUILD_ID="Discord Server ID"
npm run register:commands
```

`DISCORD_GUILD_ID` を指定すると、そのサーバーだけに即時反映されます。指定しない場合はグローバルコマンドになり、反映に時間がかかることがあります。

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
