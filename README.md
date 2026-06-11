# World Cup 2026 Discord Scheduler

ワールドカップ2026の翌日分の試合予定を、毎日22:00 JSTにDiscordへ投稿するGitHub Actions用の小さなスクリプトです。

## あなたがやること

1. Discordで投稿先チャンネルのWebhook URLを作る
   - サーバー設定
   - 連携サービス / Integrations
   - Webhookを作成
   - 投稿先チャンネルを選択
   - Webhook URLをコピー

2. API-FootballのAPIキーを用意する
   - API-Sports / API-Footballでキーを取得してください。

3. GitHubで新しいリポジトリを作る
   - 例: `world-cup-2026-scheduler`
   - Public / Private はどちらでも構いません。

4. GitHub Secretsを登録する
   - GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions`
   - `New repository secret` で以下を追加:
     - `DISCORD_WEBHOOK_URL`
     - `API_FOOTBALL_KEY`

5. このローカルフォルダをGitHubへpushする

```powershell
git init
git add .
git commit -m "Add World Cup Discord scheduler"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/world-cup-2026-scheduler.git
git push -u origin main
```

`YOUR_NAME` とリポジトリ名は自分のGitHubに合わせて変えてください。

6. 動作テストする
   - GitHubリポジトリの `Actions`
   - `Post World Cup Matches`
   - `Run workflow`

## 実行タイミング

`.github/workflows/post-worldcup.yml` のcronは以下です。

```yaml
cron: "0 13 * * *"
```

GitHub ActionsのcronはUTC基準なので、これは毎日22:00 JSTです。

## ローカルで投稿内容だけ確認する

Discordには投稿せず、出力だけ確認できます。

```powershell
$env:API_FOOTBALL_KEY="your_api_football_key"
$env:DRY_RUN="1"
node post-worldcup.js
```

実際にDiscordへ投稿する場合は、`DISCORD_WEBHOOK_URL` も設定して `DRY_RUN` を外してください。
