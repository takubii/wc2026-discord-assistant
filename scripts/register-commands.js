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
        name: "squad",
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
        description: "全グループの順位を表示します",
        type: 1,
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
