import { GROUPS, canonicalTeamName, teamLabel } from "./team-data.js";
import { fifaRankSuffix, refreshFifaRankings } from "./fifa-rankings.js";
import { todayInTokyo, ymdInTokyo } from "./schedule.js";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
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
  ENG: "🏴",
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
  SCO: "🏴",
  SEN: "🇸🇳",
  SUI: "🇨🇭",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  URU: "🇺🇾",
  USA: "🇺🇸",
  UZB: "🇺🇿",
};

function displayDateInTokyo(ymd) {
  const date = new Date(`${ymd}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function hmInTokyo(dateString) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateString));
}

async function fetchEspnEvents() {
  const res = await fetch(ESPN_URL);
  if (!res.ok) throw new Error(`ESPN error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.events ?? [];
}

function normalizeEvent(event) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  return {
    id: event.id,
    date: event.date,
    phase: event.season?.slug ?? "",
    completed: event.status?.type?.completed === true,
    status: event.status?.type?.shortDetail ?? event.status?.type?.description ?? "",
    home: {
      id: home?.team?.id ?? "",
      name: home?.team?.displayName ?? home?.team?.name ?? "TBD",
      code: home?.team?.abbreviation ?? "",
      score: Number(home?.score ?? 0),
    },
    away: {
      id: away?.team?.id ?? "",
      name: away?.team?.displayName ?? away?.team?.name ?? "TBD",
      code: away?.team?.abbreviation ?? "",
      score: Number(away?.score ?? 0),
    },
    scorers: scoringEvents(competition?.details ?? []),
  };
}

async function allMatches() {
  return (await fetchEspnEvents()).map(normalizeEvent);
}

function groupForTeam(teamName) {
  const canonical = canonicalTeamName(teamName);
  return Object.entries(GROUPS).find(([, teams]) => teams.includes(canonical))?.[0] ?? "";
}

function groupForMatch(match) {
  const homeGroup = groupForTeam(match.home.name);
  const awayGroup = groupForTeam(match.away.name);
  return homeGroup && homeGroup === awayGroup ? homeGroup : "";
}

function groupMatches(matches) {
  return matches.filter((match) => match.phase === "group-stage" && groupForMatch(match));
}

function initialRow(team, order) {
  return { team, order, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
}

export function calculateStandings(matches) {
  const standings = Object.fromEntries(
    Object.entries(GROUPS).map(([group, teams]) => [group, teams.map((team, index) => initialRow(team, index))])
  );
  const rowByTeam = new Map(Object.values(standings).flat().map((row) => [row.team, row]));

  for (const match of groupMatches(matches).filter((m) => m.completed)) {
    const home = rowByTeam.get(match.home.name);
    const away = rowByTeam.get(match.away.name);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.gf += match.home.score;
    home.ga += match.away.score;
    away.gf += match.away.score;
    away.ga += match.home.score;
    if (match.home.score > match.away.score) {
      home.won += 1; away.lost += 1; home.pts += 3;
    } else if (match.home.score < match.away.score) {
      away.won += 1; home.lost += 1; away.pts += 3;
    } else {
      home.drawn += 1; away.drawn += 1; home.pts += 1; away.pts += 1;
    }
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  for (const group of Object.keys(standings)) {
    standings[group].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.order - b.order);
  }
  return standings;
}

function rankMark(rank) {
  if (rank <= 2) return "🟢";
  if (rank === 3) return "🟡";
  return "⚫";
}

function statusLabel(status) {
  const map = {
    Scheduled: "予定",
    "Full Time": "試合終了",
    FT: "試合終了",
    "Half Time": "ハーフタイム",
    Postponed: "延期",
    Canceled: "中止",
  };
  return map[status] ?? status;
}

function teamWithRank(teamName) {
  return `${teamLabel(teamName)}${fifaRankSuffix(teamName)}`;
}

function scoringEvents(details) {
  return details
    .filter((detail) => detail.scoringPlay)
    .map((detail) => {
      const scorer = detail.athletesInvolved?.[0] ?? detail.participants?.[0]?.athlete ?? detail.participants?.[0] ?? {};
      return {
        minute: detail.clock?.displayValue ?? "",
        teamId: detail.team?.id ?? "",
        scorer: scorer.displayName ?? scorer.fullName ?? scorer.shortName ?? "Unknown",
        jersey: scorer.jersey ?? "",
        ownGoal: detail.ownGoal === true,
        penaltyKick: detail.penaltyKick === true,
        type: detail.type?.text ?? "",
      };
    });
}

function scoringTeam(match, scorer) {
  if (scorer.teamId && scorer.teamId === match.home.id) return match.home;
  if (scorer.teamId && scorer.teamId === match.away.id) return match.away;
  return null;
}

function scorerSuffix(scorer) {
  const labels = [];
  if (scorer.ownGoal) labels.push("OG");
  if (scorer.penaltyKick) labels.push("PK");
  return labels.length ? ` (${labels.join(", ")})` : "";
}

function scorerLine(match, scorer) {
  const team = scoringTeam(match, scorer);
  const flag = TEAM_FLAGS[team?.code] ?? "⚽";
  const minute = scorer.minute ? `${scorer.minute} ` : "";
  const jersey = scorer.jersey ? `#${scorer.jersey} ` : "";
  return `${flag} ${minute}${jersey}${scorer.scorer}${scorerSuffix(scorer)}`;
}

function formatScorers(match) {
  if (!match.completed || match.scorers.length === 0) return "";
  return `\n> ${match.scorers.map((scorer) => scorerLine(match, scorer)).join(" / ")}`;
}

function formatResultLine(match) {
  const time = hmInTokyo(match.date);
  if (match.completed) {
    return `• **${time}** ${teamWithRank(match.home.name)} ${match.home.score}-${match.away.score} ${teamWithRank(match.away.name)}${formatScorers(match)}`;
  }
  return `• **${time}** ${teamWithRank(match.home.name)} vs ${teamWithRank(match.away.name)}（${statusLabel(match.status) || "未開催"}）`;
}

function formatTeamMatchLine(match) {
  const date = displayDateInTokyo(ymdInTokyo(new Date(match.date)));
  return `• **${date} ${hmInTokyo(match.date)}** ${teamWithRank(match.home.name)} ${match.completed ? `${match.home.score}-${match.away.score}` : "vs"} ${teamWithRank(match.away.name)}${match.completed ? "" : `（${statusLabel(match.status) || "未開催"}）`}`;
}

function formatResultsByGroup(matches) {
  if (matches.length === 0) return ["この日の試合はありません。"];

  const grouped = new Map(Object.keys(GROUPS).map((group) => [group, []]));
  const otherMatches = [];

  for (const match of matches) {
    const group = match.phase === "group-stage" ? groupForMatch(match) : "";
    if (group && grouped.has(group)) {
      grouped.get(group).push(match);
    } else {
      otherMatches.push(match);
    }
  }

  const sections = [];
  for (const [group, groupMatches] of grouped.entries()) {
    if (groupMatches.length === 0) continue;
    sections.push([`## Group ${group}`, ...groupMatches.map(formatResultLine)].join("\n"));
  }

  if (otherMatches.length > 0) {
    sections.push(["## ノックアウトステージ", ...otherMatches.map(formatResultLine)].join("\n"));
  }

  return sections.length ? sections : matches.map(formatResultLine);
}

export async function buildResultsPayloads(targetDate = todayInTokyo()) {
  await refreshFifaRankings();
  const matches = (await allMatches())
    .filter((match) => ymdInTokyo(new Date(match.date)) === targetDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const header = `# 🧾 ${displayDateInTokyo(targetDate)} の結果`;
  return [{ content: [header, ...formatResultsByGroup(matches)].join("\n\n"), allowed_mentions: { parse: [] } }];
}

function formatGroup(group, rows) {
  return [
    `## Group ${group}`,
    ...rows.map((row, index) => {
      const rank = index + 1;
      const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
      return `${rankMark(rank)} **${rank}. ${teamLabel(row.team)}**  ${row.pts}pt  ${row.played}試合  ${row.won}勝${row.drawn}分${row.lost}敗  得失${gd}`;
    }),
  ].join("\n");
}

function standingsPayload(title, standings, groups) {
  return {
    content: [
      title,
      "🟢 1〜2位: 自動突破圏　🟡 3位: 通過争い　⚫ 4位: 厳しい",
      "",
      ...groups.map((group) => formatGroup(group, standings[group])),
    ].join("\n\n"),
    allowed_mentions: { parse: [] },
  };
}

export async function buildStandingsPayloads() {
  await refreshFifaRankings();
  const standings = calculateStandings(await allMatches());
  return [
    standingsPayload("# 📊 Groups A-D", standings, ["A", "B", "C", "D"]),
    standingsPayload("# 📊 Groups E-H", standings, ["E", "F", "G", "H"]),
    standingsPayload("# 📊 Groups I-L", standings, ["I", "J", "K", "L"]),
  ];
}

export async function buildGroupStandingsPayloads(group) {
  await refreshFifaRankings();
  const normalizedGroup = String(group ?? "").trim().toUpperCase();
  if (!GROUPS[normalizedGroup]) {
    throw new Error("グループは A〜L のいずれかで指定してください。");
  }
  const standings = calculateStandings(await allMatches());
  return [{
    content: [
      `# 📊 Group ${normalizedGroup}`,
      "🟢 1〜2位: 自動突破圏　🟡 3位: 通過争い　⚫ 4位: 厳しい",
      "",
      ...standings[normalizedGroup].map((row, index) => {
        const rank = index + 1;
        const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
        return `${rankMark(rank)} **${rank}. ${teamLabel(row.team)}**  ${row.pts}pt  ${row.played}試合  ${row.won}勝${row.drawn}分${row.lost}敗  得失${gd}`;
      }),
    ].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}

export async function buildDailySummaryPayloads(targetDate = todayInTokyo()) {
  return [...(await buildResultsPayloads(targetDate)), ...(await buildStandingsPayloads())];
}

export async function buildTeamSchedulePayloads(teamQuery, scope = "all") {
  await refreshFifaRankings();
  const team = canonicalTeamName(teamQuery || "Japan");
  let matches = (await allMatches())
    .filter((match) => match.home.name === team || match.away.name === team)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const today = todayInTokyo();
  if (scope === "today") matches = matches.filter((match) => ymdInTokyo(new Date(match.date)) === today);
  if (scope === "future") matches = matches.filter((match) => new Date(match.date) >= new Date());

  const lines = matches.length ? matches.map(formatTeamMatchLine) : ["該当する試合はありません。"];
  return [{
    content: [`# 🇯🇵 ${teamLabel(team)}戦`, "", ...lines].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}
