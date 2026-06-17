# WC2026 Discord Assistant

World Cup 2026の試合予定、結果、順位、代表メンバー、注目選手をDiscordへ投稿するための小さな通知ツールです。

導入方法は [docs/setup.md](docs/setup.md) に分けています。

## 自動投稿

Cloudflare Worker Cron Triggerで以下を自動投稿します。

- 毎日16:00 JST: 翌日の試合予定
- 毎日16:00 JST: 今日の結果
- 5分おき: 開始15分前前後の公式スタメン

投稿先はCloudflare Worker Secretで指定します。

- `DISCORD_WEBHOOK_URL`: 試合日程
- `DISCORD_RESULTS_WEBHOOK_URL`: 結果と順位
- `DISCORD_LINEUP_WEBHOOK_URL`: スタメン通知。未設定なら試合日程チャンネルへ投稿

GitHub Actionsにも手動実行用workflowを残していますが、定期投稿はCloudflare Worker側で動きます。

## Slash Command

Discordで `/wc` を使います。

```text
/wc today
/wc tomorrow
/wc date value:2026-06-14
/wc results date:2026-06-14
/wc standings
/wc standings group:Group C
/wc rankings
/wc rankings group:Group C
/wc rankings english:true
/wc summary date:2026-06-14
/wc japan scope:今後の試合
/wc lineup
/wc lineup team:日本
/wc lineup image:true
/wc team team:日本
/wc team team:イングランド position:左ウイング
/wc player name:Kubo
/wc notable
/wc notable team:日本
/wc notable position:攻撃的MF limit:10
/wc positions team:キュラソー島
```

`team`、`positions`、`notable` の `team` は日本語入力と候補表示に対応しています。

## ローカル確認

Discordへ投稿せず、内容だけ確認できます。

```powershell
$env:DRY_RUN="1"
$env:TARGET_DATE="2026-06-12"
npm run post
```

今日の結果:

```powershell
$env:DRY_RUN="1"
$env:TARGET_DATE="2026-06-12"
npm run post:summary
```

## データ

- 試合予定・結果: ESPNの公開JSON
- 予備の試合予定: TheSportsDB
- FIFAランキング: FIFA公式ライブランキングAPI。取得失敗時はリポジトリ内の固定キャッシュへフォールバック
- 代表メンバー、背番号、年齢: FIFA公式Squad List PDF由来のキャッシュ済みデータ
- 詳細ポジション、市場価値: Transfermarkt由来のキャッシュ済みデータ

Discordコマンド実行時は、代表メンバーや市場価値の外部サイトへアクセスせず、リポジトリ内のキャッシュ済みデータを使います。

## Security

実際のWebhook URL、Bot Token、API keyはリポジトリに入れないでください。Cloudflare WorkerのSecret、GitHub ActionsのSecret、ローカル環境変数で管理します。
