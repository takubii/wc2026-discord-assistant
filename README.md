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

## 投稿イメージ

Discordにはembed形式で投稿します。

```text
🏆 FIFA World Cup 2026｜明日の試合予定

6月14日(日)（JST）
04:00  Qatar vs Switzerland
　🏟️ Levi's Stadium

07:00  Brazil vs Morocco
　🏟️ MetLife Stadium
```

## Troubleshooting

### API-FootballのFree planで2026 seasonにアクセスできない

初期実装ではAPI-Footballを使っていましたが、Free planでは以下のようなエラーが返る場合があります。

```text
Free plans do not have access to this season, try from 2022 to 2024.
```

この場合、Discord WebhookやGitHub Actionsの設定ではなく、API-Football側のプラン制限です。そのため現在の実装ではAPI-Footballを使わず、ESPNの公開JSONを主データソースにしています。
