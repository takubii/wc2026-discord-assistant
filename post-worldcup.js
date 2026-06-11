const TZ = "Asia/Tokyo";
const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const THESPORTSDB_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026";
const ENGLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const VENUE_LOCATIONS = {
  "AT&T Stadium": "Arlington, Texas, USA",
  "BC Place": "Vancouver, British Columbia, Canada",
  "BMO Field": "Toronto, Ontario, Canada",
  "Estadio Akron": "Guadalajara, Jalisco, Mexico",
  "Estadio Banorte": "Mexico City, Mexico",
  "Estadio BBVA": "Guadalupe, Nuevo Leon, Mexico",
  "GEHA Field at Arrowhead Stadium": "Kansas City, Missouri, USA",
  "Gillette Stadium": "Foxborough, Massachusetts, USA",
  "Hard Rock Stadium": "Miami Gardens, Florida, USA",
  "Levi's Stadium": "Santa Clara, California, USA",
  "Lincoln Financial Field": "Philadelphia, Pennsylvania, USA",
  "Lumen Field": "Seattle, Washington, USA",
  "Mercedes-Benz Stadium": "Atlanta, Georgia, USA",
  "MetLife Stadium": "East Rutherford, New Jersey, USA",
  "NRG Stadium": "Houston, Texas, USA",
  "SoFi Stadium": "Inglewood, California, USA",
};
const TEAM_FLAGS = {
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
  BIH: "🇧🇦",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  CIV: "🇨🇮",
  COL: "🇨🇴",
  COD: "🇨🇩",
  CPV: "🇨🇻",
  CRO: "🇭🇷",
  CUW: "🇨🇼",
  CZE: "🇨🇿",
  ECU: "🇪🇨",
  EGY: "🇪🇬",
  ENG: ENGLAND_FLAG,
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  HAI: "🇭🇹",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  JPN: "🇯🇵",
  JOR: "🇯🇴",
  KOR: "🇰🇷",
  KSA: "🇸🇦",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  NED: "🇳🇱",
  NOR: "🇳🇴",
  NZL: "🇳🇿",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  POR: "🇵🇹",
  QAT: "🇶🇦",
  RSA: "🇿🇦",
  SCO: SCOTLAND_FLAG,
  SEN: "🇸🇳",
  SUI: "🇨🇭",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  URU: "🇺🇾",
  USA: "🇺🇸",
  UZB: "🇺🇿",
};
const TEAM_NAME_TO_CODE = {
  Algeria: "ALG",
  Argentina: "ARG",
  Australia: "AUS",
  Austria: "AUT",
  Belgium: "BEL",
  "Bosnia-Herzegovina": "BIH",
  Brazil: "BRA",
  Canada: "CAN",
  "Cape Verde": "CPV",
  Colombia: "COL",
  "Congo DR": "COD",
  Croatia: "CRO",
  "Curaçao": "CUW",
  Czechia: "CZE",
  Ecuador: "ECU",
  Egypt: "EGY",
  England: "ENG",
  France: "FRA",
  Germany: "GER",
  Ghana: "GHA",
  Haiti: "HAI",
  Iran: "IRN",
  Iraq: "IRQ",
  "Ivory Coast": "CIV",
  Japan: "JPN",
  Jordan: "JOR",
  Mexico: "MEX",
  Morocco: "MAR",
  Netherlands: "NED",
  "New Zealand": "NZL",
  Norway: "NOR",
  Panama: "PAN",
  Paraguay: "PAR",
  Portugal: "POR",
  Qatar: "QAT",
  "Saudi Arabia": "KSA",
  Scotland: "SCO",
  Senegal: "SEN",
  "South Africa": "RSA",
  "South Korea": "KOR",
  Spain: "ESP",
  Sweden: "SWE",
  Switzerland: "SUI",
  Tunisia: "TUN",
  Türkiye: "TUR",
  Uruguay: "URU",
  USA: "USA",
  "United States": "USA",
  Uzbekistan: "UZB",
};

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

function teamFromEspnCompetition(competition, homeAway) {
  const competitor = competition?.competitors?.find((c) => c.homeAway === homeAway);
  return {
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? "TBD",
    code: competitor?.team?.abbreviation ?? "",
  };
}

function formatTeam(team) {
  const code = team.code || TEAM_NAME_TO_CODE[team.name] || "";
  const flag = TEAM_FLAGS[code] ?? "🏁";
  return `${flag}  **${team.name}**`;
}

function venueLocation(venue) {
  const name = venue?.fullName ?? venue?.displayName ?? "";
  const mapped = VENUE_LOCATIONS[name];
  if (mapped) return mapped;

  const city = venue?.address?.city;
  const country = venue?.address?.country;
  if (city && country) return `${city}, ${country}`;
  return city ?? country ?? "";
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
    const venue = competition?.venue ?? event.venue ?? {};
    return {
      date: event.date,
      home: teamFromEspnCompetition(competition, "home"),
      away: teamFromEspnCompetition(competition, "away"),
      venue: venue.fullName ?? venue.displayName ?? "",
      location: venueLocation(venue),
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
    home: { name: event.strHomeTeam ?? "TBD", code: TEAM_NAME_TO_CODE[event.strHomeTeam] ?? "" },
    away: { name: event.strAwayTeam ?? "TBD", code: TEAM_NAME_TO_CODE[event.strAwayTeam] ?? "" },
    venue: event.strVenue ?? "",
    location: VENUE_LOCATIONS[event.strVenue] ?? "",
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
      content: ["# 🏆 FIFA World Cup 2026", `## ${displayDate}（JST）`, "", "この日の試合予定はありません。"].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }

  const lines = matches
    .map((m) => {
      const time = hmInTokyo(m.date);
      const location = m.location ? ` / ${m.location}` : "";
      const venue = m.venue ? `\n> 🏟️  ${m.venue}${location}` : "";
      return `### ${time}　${formatTeam(m.home)} vs ${formatTeam(m.away)}${venue}`;
    })
    .join("\n\n");

  return {
    content: [
      "# 🏆 FIFA World Cup 2026",
      `## ${displayDate}（JST）`,
      `全${matches.length}試合`,
      "",
      lines,
    ].join("\n"),
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
