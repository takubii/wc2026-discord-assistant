const TZ = "Asia/Tokyo";
const API_URL = "https://v3.football.api-sports.io/fixtures?league=1&season=2026";

function ymdInTokyo(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hmInTokyo(dateString) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateString));
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function hasApiErrors(errors) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  return Object.keys(errors).length > 0;
}

function buildDiscordContent(matches, targetDate) {
  if (matches.length === 0) {
    return `🏆 ${targetDate} のワールドカップ試合はないよ。`;
  }

  return [
    `🏆 **${targetDate} のワールドカップ試合予定**`,
    "",
    ...matches.map((m) => {
      const time = hmInTokyo(m.fixture.date);
      const home = m.teams.home?.name ?? "TBD";
      const away = m.teams.away?.name ?? "TBD";
      return `・${time}　${home} vs ${away}`;
    }),
  ].join("\n");
}

async function main() {
  const apiKey = getRequiredEnv("API_FOOTBALL_KEY");
  const dryRun = process.env.DRY_RUN === "1";
  const discordWebhookUrl = dryRun ? null : getRequiredEnv("DISCORD_WEBHOOK_URL");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = ymdInTokyo(tomorrow);

  const res = await fetch(API_URL, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (hasApiErrors(data.errors)) {
    throw new Error(`API-Football response errors: ${JSON.stringify(data.errors)}`);
  }

  const matches = data.response
    .filter((m) => ymdInTokyo(new Date(m.fixture.date)) === targetDate)
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

  const content = buildDiscordContent(matches, targetDate);

  if (dryRun) {
    console.log(content);
    return;
  }

  const discordRes = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!discordRes.ok) {
    const body = await discordRes.text();
    throw new Error(`Discord webhook error: ${discordRes.status} ${body}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
