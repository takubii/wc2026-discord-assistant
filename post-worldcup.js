const TZ = "Asia/Tokyo";
const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const THESPORTSDB_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026";

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

function displayDateInTokyo(ymd) {
  const date = new Date(`${ymd}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function targetDateInTokyo() {
  if (process.env.TARGET_DATE) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(process.env.TARGET_DATE)) {
      throw new Error("TARGET_DATE must be YYYY-MM-DD");
    }
    return process.env.TARGET_DATE;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return ymdInTokyo(tomorrow);
}

function teamNameFromEspnCompetition(competition, homeAway) {
  const competitor = competition?.competitors?.find((c) => c.homeAway === homeAway);
  return competitor?.team?.displayName ?? competitor?.team?.name ?? "TBD";
}

async function fetchEspnMatches() {
  const res = await fetch(ESPN_URL);
  if (!res.ok) {
    throw new Error(`ESPN error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.events) || data.events.length === 0) {
    throw new Error("ESPN returned no events");
  }

  return data.events.map((event) => {
    const competition = event.competitions?.[0];
    return {
      date: event.date,
      home: teamNameFromEspnCompetition(competition, "home"),
      away: teamNameFromEspnCompetition(competition, "away"),
      venue: competition?.venue?.fullName ?? event.venue?.displayName ?? "",
      source: "ESPN",
    };
  });
}

async function fetchTheSportsDbMatches() {
  const res = await fetch(THESPORTSDB_URL);
  if (!res.ok) {
    throw new Error(`TheSportsDB error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.events) || data.events.length === 0) {
    throw new Error("TheSportsDB returned no events");
  }

  return data.events.map((event) => ({
    date: `${event.strTimestamp ?? `${event.dateEvent}T${event.strTime}`}Z`,
    home: event.strHomeTeam ?? "TBD",
    away: event.strAwayTeam ?? "TBD",
    venue: event.strVenue ?? "",
    source: "TheSportsDB",
  }));
}

async function fetchMatches() {
  try {
    return await fetchEspnMatches();
  } catch (espnError) {
    console.warn(`ESPN fetch failed, falling back to TheSportsDB: ${espnError.message}`);
    return fetchTheSportsDbMatches();
  }
}

function buildDiscordPayload(matches, targetDate) {
  const displayDate = displayDateInTokyo(targetDate);

  if (matches.length === 0) {
    return {
      content: "",
      embeds: [
        {
          title: "FIFA World Cup 2026",
          description: `**${displayDate}（JST）** の試合予定はありません。`,
          color: 0x1f8b4c,
          footer: { text: "Times shown in Japan Standard Time" },
        },
      ],
      allowed_mentions: { parse: [] },
    };
  }

  const lines = matches
    .map((m) => {
      const time = hmInTokyo(m.date);
      const venue = m.venue ? `\n　🏟️ ${m.venue}` : "";
      return `**${time}**  ${m.home} vs ${m.away}${venue}`;
    })
    .join("\n\n");

  const sources = [...new Set(matches.map((m) => m.source))].join(", ");

  return {
    content: "🏆 **FIFA World Cup 2026｜明日の試合予定**",
    embeds: [
      {
        title: `${displayDate}（JST）`,
        description: lines,
        color: 0xc1121f,
        footer: { text: `${matches.length} match${matches.length === 1 ? "" : "es"} | Source: ${sources}` },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const discordWebhookUrl = dryRun ? null : getRequiredEnv("DISCORD_WEBHOOK_URL");
  const targetDate = targetDateInTokyo();

  const matches = (await fetchMatches())
    .filter((m) => ymdInTokyo(new Date(m.date)) === targetDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const payload = buildDiscordPayload(matches, targetDate);

  if (dryRun) {
    console.log(payload.content);
    for (const embed of payload.embeds) {
      console.log(`\n${embed.title}`);
      console.log(embed.description);
      if (embed.footer?.text) {
        console.log(`\n${embed.footer.text}`);
      }
    }
    return;
  }

  const discordRes = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
