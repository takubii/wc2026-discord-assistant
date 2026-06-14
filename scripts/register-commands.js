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
            description: "任意のポジション絞り込み。例: 左ウイング, CF, 攻撃的MF",
            type: 3,
            required: false,
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
            name: "text",
            description: "画像ではなく文字でスタメンを表示します",
            type: 5,
            required: false,
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
