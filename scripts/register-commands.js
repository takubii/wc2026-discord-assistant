const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) throw new Error("DISCORD_BOT_TOKEN is required");
if (!applicationId) throw new Error("DISCORD_APPLICATION_ID is required");

const commands = [
  {
    name: "wc",
    description: "FIFA World Cup 2026 schedule",
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
            description: "国名。例: Japan",
            type: 3,
            required: true,
          },
          {
            name: "position",
            description: "任意のポジション絞り込み。例: Left Winger, DF, FW",
            type: 3,
            required: false,
          },
        ],
      },
      {
        name: "player",
        description: "選手名で詳細ポジションを検索します",
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
            description: "国名。例: Japan",
            type: 3,
            required: true,
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
