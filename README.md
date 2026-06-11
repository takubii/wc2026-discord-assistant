# World Cup 2026 Discord Scheduler

ワールドカップ2026の翌日分の試合予定を、毎日22:00 JSTにDiscordへ投稿するGitHub Actions用の小さなスクリプトです。

試合予定はESPNの公開JSONから取得します。ESPNが取得できない場合はTheSportsDBを予備として使います。

## あなたがやること

1. Discordで投稿先チャンネルのWebhook URLを作る
   - サーバー設定
   - 連携サービス / Integrations
   - Webhookを作成
   - 投稿先チャンネルを選択
   - Webhook URLをコピー

2. GitHubで新しいリポジトリを作る
   - 例: `world-cup-2026-scheduler`
   - Public / Private はどちらでも構いません。

3. GitHub Secretsを登録する
   - GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions`
   - `New repository secret` で以下を追加:
     - `DISCORD_WEBHOOK_URL`

4. このローカルフォルダをGitHubへpushする

```powershell
git init
git add .
git commit -m "Add World Cup Discord scheduler"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/world-cup-2026-scheduler.git
git push -u origin main
```

`YOUR_NAME` とリポジトリ名は自分のGitHubに合わせて変えてください。

5. 動作テストする
   - GitHubリポジトリの `Actions`
   - `Post World Cup Matches`
   - `Run workflow`
   - `target_date` に `2026-06-12` のような日付を入れると、その日の投稿内容をテストできます。
   - `dry_run` を `true` にするとDiscordへ投稿せず、Actionsログに内容だけ出します。

## 実行タイミング

`.github/workflows/post-worldcup.yml` のcronは以下です。

```yaml
cron: "0 13 * * *"
```

GitHub ActionsのcronはUTC基準なので、これは毎日22:00 JSTです。

## ローカルで投稿内容だけ確認する

Discordには投稿せず、出力だけ確認できます。

```powershell
$env:DRY_RUN="1"
$env:TARGET_DATE="2026-06-12"
node post-worldcup.js
```

実際にDiscordへ投稿する場合は、`DISCORD_WEBHOOK_URL` を設定して `DRY_RUN` を外してください。

## Slash Command

Cloudflare WorkerでDiscordのSlash Commandも動かせます。GitHub Actionsの定期投稿と同じ本文を返します。

使えるコマンド:

```text
/wc today
/wc tomorrow
/wc date value:2026-06-14
/wc squad team:Japan
/wc squad team:Japan position:左ウイング
/wc player name:Kubo
/wc positions team:Japan
```

### 1. Discord Applicationを作る

1. Discord Developer PortalでNew Applicationを作成
2. `General Information` から以下を控える
   - `APPLICATION ID`
   - `PUBLIC KEY`
3. `Bot` からBot Tokenを作成して控える
4. `OAuth2` のURL Generatorで `applications.commands` を選び、対象サーバーへインストールする

Bot TokenはSlash Command登録にだけ使います。Botを常駐させる必要はありません。

### 2. Cloudflare Workerをdeployする

```powershell
npm install
npx wrangler login
npm run deploy
npx wrangler secret put DISCORD_PUBLIC_KEY
```

`DISCORD_PUBLIC_KEY` にはDiscord ApplicationのPublic Keyを入れてください。

`npm run deploy` の出力に出る `https://...workers.dev` を控えます。

### 3. DiscordにInteraction Endpointを設定する

Discord Developer Portalの `General Information` で、`Interactions Endpoint URL` にWorker URLを設定します。

例:

```text
https://world-cup-2026-scheduler.<your-subdomain>.workers.dev
```

### 4. Slash Commandを登録する

PowerShellで以下を実行します。

```powershell
$env:DISCORD_APPLICATION_ID="Discord Application ID"
$env:DISCORD_BOT_TOKEN="Discord Bot Token"
$env:DISCORD_GUILD_ID="Discord Server ID"
npm run register:commands
```

`DISCORD_GUILD_ID` を指定すると、そのサーバーだけに即時反映されます。指定しない場合はグローバルコマンドになり、反映に時間がかかることがあります。

## Player Data

代表メンバーはESPNのWorld Cup squad記事から取得し、`data/players.json` にキャッシュします。詳細ポジションはTransfermarktから低頻度で補完します。

```powershell
npm run update:players -- --enrich-all
```

現在のキャッシュでは全48チームの代表メンバーを保持し、Transfermarktの国別スカッドページで一致した選手には詳細メインポジションを補完しています。現時点では1249人中1120人に詳細ポジションが入っています。Transfermarktへのアクセスは低頻度に抑えるため、Discordコマンド実行時には外部サイトへアクセスせず、キャッシュ済みデータだけを使います。

## 投稿イメージ

Discordには見出し付きMarkdownで投稿します。embedより文字が大きく見える形式です。

```text
🏆 FIFA World Cup 2026｜明日の試合予定

6月14日(日)（JST）
04:00  🇶🇦  Qatar vs 🇨🇭  Switzerland
🏟️  Levi's Stadium / Santa Clara, California, USA

07:00  🇧🇷  Brazil vs 🇲🇦  Morocco
🏟️  MetLife Stadium / East Rutherford, New Jersey, USA
```

## Troubleshooting

### API-FootballのFree planで2026 seasonにアクセスできない

初期実装ではAPI-Footballを使っていましたが、Free planでは以下のようなエラーが返る場合があります。

```text
Free plans do not have access to this season, try from 2022 to 2024.
```

この場合、Discord WebhookやGitHub Actionsの設定ではなく、API-Football側のプラン制限です。そのため現在の実装ではAPI-Footballを使わず、ESPNの公開JSONを主データソースにしています。
