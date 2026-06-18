import { GROUPS, canonicalTeamName, teamLabel } from "./team-data.js";

export const FIFA_RANKING_UPDATED_AT = "2026-06-11";
const FIFA_LIVE_RANKING_URL =
  "https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&language=en";
const FIFA_RANKING_PAGE_LINK = "[公式ランキング](https://inside.fifa.com/fifa-world-ranking/men)";
const RANKING_CACHE_MS = 5 * 60 * 1000;

const FIFA_COUNTRY_CODE_TO_TEAM = {
  ALG: "Algeria",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BIH: "Bosnia-Herzegovina",
  BRA: "Brazil",
  CAN: "Canada",
  CIV: "Ivory Coast",
  COL: "Colombia",
  COD: "Congo DR",
  CPV: "Cape Verde",
  CRO: "Croatia",
  CUW: "Curaçao",
  CZE: "Czechia",
  ECU: "Ecuador",
  EGY: "Egypt",
  ENG: "England",
  ESP: "Spain",
  FRA: "France",
  GER: "Germany",
  GHA: "Ghana",
  HAI: "Haiti",
  IRN: "Iran",
  IRQ: "Iraq",
  JPN: "Japan",
  JOR: "Jordan",
  KOR: "South Korea",
  KSA: "Saudi Arabia",
  MAR: "Morocco",
  MEX: "Mexico",
  NED: "Netherlands",
  NOR: "Norway",
  NZL: "New Zealand",
  PAN: "Panama",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Qatar",
  RSA: "South Africa",
  SCO: "Scotland",
  SEN: "Senegal",
  SUI: "Switzerland",
  SWE: "Sweden",
  TUN: "Tunisia",
  TUR: "Türkiye",
  URU: "Uruguay",
  USA: "United States",
  UZB: "Uzbekistan",
};

export const FIFA_RANKINGS = {
  Algeria: { rank: 28, points: 1571.03 },
  Argentina: { rank: 1, points: 1877.27 },
  Australia: { rank: 27, points: 1579.34 },
  Austria: { rank: 24, points: 1597.4 },
  Belgium: { rank: 9, points: 1742.24 },
  "Bosnia-Herzegovina": { rank: 64, points: 1387.22 },
  Brazil: { rank: 6, points: 1765.86 },
  Canada: { rank: 30, points: 1559.48 },
  "Cape Verde": { rank: 67, points: 1371.11 },
  Colombia: { rank: 13, points: 1698.35 },
  "Congo DR": { rank: 46, points: 1474.43 },
  Croatia: { rank: 11, points: 1714.87 },
  "Curaçao": { rank: 82, points: 1294.77 },
  Czechia: { rank: 40, points: 1505.74 },
  Ecuador: { rank: 23, points: 1598.52 },
  Egypt: { rank: 29, points: 1562.37 },
  England: { rank: 4, points: 1828.02 },
  France: { rank: 3, points: 1870.7 },
  Germany: { rank: 10, points: 1735.77 },
  Ghana: { rank: 73, points: 1346.88 },
  Haiti: { rank: 83, points: 1293.1 },
  Iran: { rank: 20, points: 1619.58 },
  Iraq: { rank: 57, points: 1446.28 },
  "Ivory Coast": { rank: 33, points: 1540.87 },
  Japan: { rank: 18, points: 1661.58 },
  Jordan: { rank: 63, points: 1387.74 },
  Mexico: { rank: 14, points: 1687.48 },
  Morocco: { rank: 7, points: 1755.1 },
  Netherlands: { rank: 8, points: 1753.57 },
  "New Zealand": { rank: 85, points: 1275.58 },
  Norway: { rank: 31, points: 1557.44 },
  Panama: { rank: 34, points: 1539.16 },
  Paraguay: { rank: 41, points: 1505.35 },
  Portugal: { rank: 5, points: 1767.85 },
  Qatar: { rank: 56, points: 1450.31 },
  "Saudi Arabia": { rank: 61, points: 1423.88 },
  Scotland: { rank: 42, points: 1503.34 },
  Senegal: { rank: 15, points: 1684.07 },
  "South Africa": { rank: 60, points: 1428.38 },
  "South Korea": { rank: 25, points: 1591.63 },
  Spain: { rank: 2, points: 1874.71 },
  Sweden: { rank: 38, points: 1509.79 },
  Switzerland: { rank: 19, points: 1650.06 },
  Tunisia: { rank: 45, points: 1476.41 },
  Türkiye: { rank: 22, points: 1605.73 },
  "United States": { rank: 17, points: 1671.23 },
  Uruguay: { rank: 16, points: 1673.07 },
  Uzbekistan: { rank: 50, points: 1458.73 },
};

let rankingCache = {
  rankings: FIFA_RANKINGS,
  source: "cache",
  fetchedAt: null,
  error: null,
};
let rankingFetchPromise = null;

function localizedTeamName(entry) {
  return entry.TeamName?.find((name) => name.Locale === "en-GB")?.Description ?? entry.TeamName?.[0]?.Description ?? "";
}

function canonicalTeamFromRanking(entry) {
  return FIFA_COUNTRY_CODE_TO_TEAM[entry.IdCountry] ?? "";
}

function normalizeLiveRankings(data) {
  const rankings = {};
  for (const entry of data.Results ?? []) {
    const team = canonicalTeamFromRanking(entry);
    if (!team || !Object.values(GROUPS).flat().includes(team)) continue;

    const rank = Number(entry.Rank);
    const points = Number(entry.TotalPoints);
    if (!Number.isFinite(rank) || !Number.isFinite(points)) continue;

    const previousRank = Number(entry.PrevRank);
    const previousPoints = Number(entry.PrevPoints);
    rankings[team] = {
      rank,
      points,
      previousRank: Number.isFinite(previousRank) ? previousRank : null,
      previousPoints: Number.isFinite(previousPoints) ? previousPoints : null,
      movement: Number(entry.RankingMovement ?? 0),
      countryCode: entry.IdCountry ?? "",
      sourceName: localizedTeamName(entry),
    };
  }
  return rankings;
}

async function fetchLiveFifaRankings() {
  const res = await fetch(FIFA_LIVE_RANKING_URL, {
    headers: {
      "User-Agent": "wc2026-discord-assistant",
      Referer: "https://inside.fifa.com/fifa-world-ranking/men",
    },
  });
  if (!res.ok) throw new Error(`FIFA live ranking error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const rankings = normalizeLiveRankings(data);
  const expectedTeams = Object.values(GROUPS).flat().length;
  if (Object.keys(rankings).length < expectedTeams) {
    throw new Error(`FIFA live ranking returned ${Object.keys(rankings).length}/${expectedTeams} World Cup teams`);
  }

  return rankings;
}

export async function refreshFifaRankings({ force = false } = {}) {
  const now = Date.now();
  if (!force && rankingCache.source === "live" && rankingCache.fetchedAt && now - rankingCache.fetchedAt < RANKING_CACHE_MS) {
    return rankingCache;
  }
  if (rankingFetchPromise) return rankingFetchPromise;

  rankingFetchPromise = fetchLiveFifaRankings()
    .then((rankings) => {
      rankingCache = {
        rankings,
        source: "live",
        fetchedAt: Date.now(),
        error: null,
      };
      return rankingCache;
    })
    .catch((err) => {
      rankingCache = {
        rankings: rankingCache.rankings ?? FIFA_RANKINGS,
        source: rankingCache.source === "live" ? "live-stale" : "cache",
        fetchedAt: rankingCache.fetchedAt,
        error: err.message,
      };
      console.warn(`FIFA live ranking refresh failed: ${err.message}`);
      return rankingCache;
    })
    .finally(() => {
      rankingFetchPromise = null;
    });

  return rankingFetchPromise;
}

export function fifaRanking(teamName) {
  return rankingCache.rankings[canonicalTeamName(teamName)] ?? FIFA_RANKINGS[canonicalTeamName(teamName)] ?? null;
}

function movementText(ranking) {
  const movement = Number(ranking?.movement ?? 0);
  if (movement > 0) return `↑${movement}`;
  if (movement < 0) return `↓${Math.abs(movement)}`;
  return "";
}

function pointsDeltaText(ranking) {
  const current = Number(ranking?.points);
  const previous = Number(ranking?.previousPoints);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "";
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return "";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}pt`;
}

function rankingSourceLine(group = "") {
  if (rankingCache.source === "live" || rankingCache.source === "live-stale") {
    const fetched = rankingCache.fetchedAt
      ? new Intl.DateTimeFormat("ja-JP", {
          timeZone: "Asia/Tokyo",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(rankingCache.fetchedAt))
      : "";
    const stale = rankingCache.source === "live-stale" ? " / 一時的に最新取得失敗、直近取得分を使用" : "";
    return `${group || "出場48チーム"}${fetched ? ` / ${fetched}` : ""}${stale}`;
  }
  return `${group || "出場48チーム"} / ${FIFA_RANKING_UPDATED_AT}時点の固定キャッシュ${rankingCache.error ? " / 最新取得失敗" : ""}`;
}

export function fifaRankSuffix(teamName) {
  const ranking = fifaRanking(teamName);
  const movement = movementText(ranking);
  return ranking ? `（FIFA ${ranking.rank}位${movement ? ` ${movement}` : ""}）` : "";
}

export function fifaRankText(teamName) {
  const ranking = fifaRanking(teamName);
  const movement = movementText(ranking);
  return ranking ? `${teamLabel(canonicalTeamName(teamName))} ${ranking.rank}位${movement ? ` ${movement}` : ""}` : `${teamLabel(teamName)} 不明`;
}

export function formatFifaRankLine(homeName, awayName) {
  return `FIFAランク: ${fifaRankText(homeName)} / ${fifaRankText(awayName)}`;
}

function splitIntoMessages(header, lines, maxLength = 1990) {
  const messages = [];
  let current = header ? [header] : [];

  for (const line of lines) {
    const next = [...current, line].join("\n");
    if (next.length > maxLength && current.length > 1) {
      messages.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) messages.push(current.join("\n"));
  return messages.map((content) => ({ content, allowed_mentions: { parse: [] } }));
}

function rankingLine(team, { english = false, detailed = true } = {}) {
  const ranking = fifaRanking(team);
  const name = english ? `**${teamLabel(team)}** / ${team}` : `**${teamLabel(team)}**`;
  if (!ranking) return `- ${name}: 不明`;
  const movement = movementText(ranking);
  const pointsDelta = pointsDeltaText(ranking);
  const movementPart = [movement, detailed ? pointsDelta : ""].filter(Boolean).join(" / ");
  if (!detailed) {
    return `\`${String(ranking.rank).padStart(2, " ")}\` ${name}　${ranking.points.toFixed(2)}pt　${movement || "-"}`;
  }
  return `\`${ranking.rank}\` ${name} ${ranking.points.toFixed(2)}pt${movementPart ? ` ${movementPart}` : ""}`;
}

export async function buildFifaRankingsPayloads(group = "", options = {}) {
  await refreshFifaRankings();
  const normalizedGroup = String(group ?? "").trim().toUpperCase();
  if (normalizedGroup && !GROUPS[normalizedGroup]) {
    throw new Error("グループは A〜L のいずれかで指定してください。");
  }

  const teams = normalizedGroup ? GROUPS[normalizedGroup] : Object.values(GROUPS).flat();
  const sortedTeams = [...teams].sort((a, b) => {
    const rankA = fifaRanking(a)?.rank ?? Number.POSITIVE_INFINITY;
    const rankB = fifaRanking(b)?.rank ?? Number.POSITIVE_INFINITY;
    return rankA - rankB || teamLabel(a).localeCompare(teamLabel(b), "ja");
  });
  const title = normalizedGroup ? `# 🌐 FIFAランキング / Group ${normalizedGroup}` : "# 🌐 FIFAランキング";
  const header = [
    title,
    rankingSourceLine(normalizedGroup ? `Group ${normalizedGroup}` : ""),
    FIFA_RANKING_PAGE_LINK,
    "",
  ].join("\n");

  return splitIntoMessages(header, sortedTeams.map((team) => rankingLine(team, {
    ...options,
    detailed: Boolean(normalizedGroup),
  })));
}
