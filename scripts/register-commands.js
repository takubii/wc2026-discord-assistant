const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) throw new Error("DISCORD_BOT_TOKEN is required");
if (!applicationId) throw new Error("DISCORD_APPLICATION_ID is required");

const commands = [
  {
    name: "wc",
    description: "FIFA World Cup 2026",
    type: 1,
    options: [
      {
        name: "today",
        description: "今日の試合予定を表示します",
        type: 1,
      },
      {
        name: "tomorrow",
        description: "明日の試合予定を表示します",
        type: 1,
      },
      {
        name: "date",
        description: "指定日の試合予定を表示します",
        type: 1,
        options: [
          {
            name: "value",
            description: "JSTの日付。例: 2026-06-14",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "team",
        description: "代表メンバーを表示します",
        type: 1,
        options: [
          {
            name: "team",
            description: "国名。例: 日本, Japan, イングランド",
            type: 3,
            required: true,
            autocomplete: true,
          },
          {
            name: "position",
            description: "任意のポジション絞り込み。例: 左ウイング, DF, FW",
            type: 3,
            required: false,
          },
        ],
      },
      {
        name: "player",
        description: "選手名で得意位置を検索します",
        type: 1,
        options: [
          {
            name: "name",
            description: "選手名。例: Mitoma",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "positions",
        description: "国ごとのポジション別リストを表示します",
        type: 1,
        options: [
          {
            name: "team",
            description: "国名。例: 日本, Japan, イングランド",
            type: 3,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: "notable",
        description: "市場価値ベースの注目選手ランキングを表示します",
        type: 1,
        options: [
          {
            name: "team",
            description: "任意の国名。例: 日本, France, イングランド",
            type: 3,
            required: false,
            autocomplete: true,
          },
          {
            name: "position",
            description: "任意のポジション絞り込み。候補から選択できます",
            type: 3,
            required: false,
            autocomplete: true,
          },
          {
            name: "limit",
            description: "表示人数。5〜50、省略時20",
            type: 4,
            required: false,
            min_value: 5,
            max_value: 50,
          },
        ],
      },
      {
        name: "results",
        description: "指定日の結果を表示します",
        type: 1,
        options: [
          {
            name: "date",
            description: "JSTの日付。省略すると今日。例: 2026-06-14",
            type: 3,
            required: false,
          },
        ],
      },
      {
        name: "standings",
        description: "グループ順位を表示します",
        type: 1,
        options: [
          {
            name: "group",
            description: "任意のグループ。省略すると全グループ",
            type: 3,
            required: false,
            choices: [
              { name: "Group A", value: "A" },
              { name: "Group B", value: "B" },
              { name: "Group C", value: "C" },
              { name: "Group D", value: "D" },
              { name: "Group E", value: "E" },
              { name: "Group F", value: "F" },
              { name: "Group G", value: "G" },
              { name: "Group H", value: "H" },
              { name: "Group I", value: "I" },
              { name: "Group J", value: "J" },
              { name: "Group K", value: "K" },
              { name: "Group L", value: "L" },
            ],
          },
        ],
      },
      {
        name: "qualified",
        description: "決勝トーナメント進出チームを表示します",
        type: 1,
      },
      {
        name: "third-place",
        description: "3位チームランキングを表示します",
        type: 1,
      },
      {
        name: "bracket",
        description: "決勝トーナメント表を表示します",
        type: 1,
        options: [
          {
            name: "stage",
            description: "任意のステージ。省略すると全体を表示します",
            type: 3,
            required: false,
            choices: [
              { name: "Round of 32", value: "round-of-32" },
              { name: "Round of 16", value: "round-of-16" },
              { name: "準々決勝", value: "quarterfinals" },
              { name: "準決勝", value: "semifinals" },
              { name: "3位決定戦", value: "3rd-place-match" },
              { name: "決勝", value: "final" },
            ],
          },
        ],
      },
      {
        name: "rankings",
        description: "出場国のFIFAランキングを表示します",
        type: 1,
        options: [
          {
            name: "group",
            description: "任意のグループ。省略すると全出場国",
            type: 3,
            required: false,
            choices: [
              { name: "Group A", value: "A" },
              { name: "Group B", value: "B" },
              { name: "Group C", value: "C" },
              { name: "Group D", value: "D" },
              { name: "Group E", value: "E" },
              { name: "Group F", value: "F" },
              { name: "Group G", value: "G" },
              { name: "Group H", value: "H" },
              { name: "Group I", value: "I" },
              { name: "Group J", value: "J" },
              { name: "Group K", value: "K" },
              { name: "Group L", value: "L" },
            ],
          },
          {
            name: "english",
            description: "国名の英語表記も表示します",
            type: 5,
            required: false,
          },
        ],
      },
      {
        name: "summary",
        description: "指定日の結果と全グループ順位をまとめて表示します",
        type: 1,
        options: [
          {
            name: "date",
            description: "JSTの日付。省略すると今日。例: 2026-06-14",
            type: 3,
            required: false,
          },
        ],
      },
      {
        name: "japan",
        description: "日本戦だけを表示します",
        type: 1,
        options: [
          {
            name: "scope",
            description: "表示範囲",
            type: 3,
            required: false,
            choices: [
              { name: "今後の試合", value: "future" },
              { name: "今日の試合", value: "today" },
              { name: "全試合", value: "all" },
            ],
          },
        ],
      },
      {
        name: "lineup",
        description: "直近試合の公式スタメンを表示します",
        type: 1,
        options: [
          {
            name: "team",
            description: "任意の国名。省略すると直近の試合。例: 日本, Netherlands",
            type: 3,
            required: false,
            autocomplete: true,
          },
          {
            name: "image",
            description: "画像でスタメンを表示します",
            type: 5,
            required: false,
          },
        ],
      },
      {
        name: "setup",
        description: "自動投稿チャンネルを設定します",
        type: 2,
        options: [
          {
            name: "channels",
            description: "投稿先チャンネルをまとめて設定します",
            type: 1,
            options: [
              {
                name: "schedule",
                description: "試合日程の投稿先チャンネル",
                type: 7,
                required: true,
                channel_types: [0, 5],
              },
              {
                name: "results",
                description: "結果通知の投稿先チャンネル",
                type: 7,
                required: true,
                channel_types: [0, 5],
              },
              {
                name: "lineup",
                description: "スタメン通知の投稿先チャンネル。省略時は試合日程チャンネル",
                type: 7,
                required: false,
                channel_types: [0, 5],
              },
            ],
          },
          {
            name: "status",
            description: "現在の自動投稿設定を表示します",
            type: 1,
          },
          {
            name: "daily",
            description: "毎日の試合日程・結果通知を有効/無効にします",
            type: 1,
            options: [
              {
                name: "enabled",
                description: "有効にする場合はtrue",
                type: 5,
                required: true,
              },
            ],
          },
          {
            name: "lineup",
            description: "開始前スタメン通知を有効/無効にします",
            type: 1,
            options: [
              {
                name: "enabled",
                description: "有効にする場合はtrue",
                type: 5,
                required: true,
              },
            ],
          },
        ],
      },
    ],
  },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bot ${token}`,
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  throw new Error(`Command registration failed: ${res.status} ${await res.text()}`);
}

const scope = guildId ? `guild ${guildId}` : "global";
console.log(`Registered ${commands.length} command(s) for ${scope}.`);
