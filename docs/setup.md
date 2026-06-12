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

GitHub Actionsの自動投稿に使います。

1. Discordで投稿先チャンネルを決める
2. サーバー設定を開く
3. `Integrations` でWebhookを作成する
4. 投稿先チャンネルを選ぶ
5. Webhook URLをコピーする

コピーしたURLはGitHub Secretsに入れます。コードには書きません。

## GitHub

1. リポジトリを作る
2. このコードをpushする
3. `Settings` -> `Secrets and variables` -> `Actions` を開く
4. `DISCORD_WEBHOOK_URL` を追加する
5. `DISCORD_RESULTS_WEBHOOK_URL` を追加する

GitHub Actionsは以下を実行します。

- `Post World Cup Matches`: 毎日22:00 JSTに翌日の試合予定を投稿
- `Post World Cup Results Summary`: 毎日16:00 JSTに今日の結果と順位を投稿

`DISCORD_WEBHOOK_URL` は試合日程チャンネル、`DISCORD_RESULTS_WEBHOOK_URL` は結果と順位チャンネルのWebhook URLを設定します。`DISCORD_RESULTS_WEBHOOK_URL` が未設定の場合、結果と順位も `DISCORD_WEBHOOK_URL` に投稿されます。

手動テストはActions画面の `Run workflow` から実行できます。`dry_run` を `true` にするとDiscordへ投稿せず、Actionsログに本文だけ出します。

## Discord Application

Slash Command用です。

1. Discord Developer PortalでApplicationを作る
2. `General Information` で `APPLICATION ID` と `PUBLIC KEY` を控える
3. `Bot` でBot Tokenを作る
4. `OAuth2` のURL Generatorで `applications.commands` を選ぶ
5. 生成されたURLから対象サーバーへインストールする

Bot Tokenはコマンド登録にだけ使います。Botを常駐させる必要はありません。

`/wc lineup` は公式スタメンが取得できた場合だけ画像付きで表示します。文字だけで確認したい場合は `/wc lineup text:true` を使います。

## Cloudflare Worker

Slash Commandの受け口です。

1. Cloudflareにログインする
2. このリポジトリで `npm install` を実行する
3. `npx wrangler login` を実行する
4. `npm run deploy` でWorkerをデプロイする
5. `DISCORD_PUBLIC_KEY` をWorker Secretに入れる
6. 任意で `GEMINI_API_KEY` をWorker Secretに入れる

```powershell
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put GEMINI_API_KEY
```

`GEMINI_API_KEY` はラインナップ画像の配置が崩れそうな場合だけ使います。未設定でも通常のルールベース配置で動きます。

デプロイ後に表示されるWorker URLをDiscord Applicationの `Interactions Endpoint URL` に設定します。

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
