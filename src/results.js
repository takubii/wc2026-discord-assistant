import { GROUPS, canonicalTeamName, teamLabel } from "./team-data.js";
import { fifaRankSuffix, refreshFifaRankings } from "./fifa-rankings.js";
import { todayInTokyo, ymdInTokyo } from "./schedule.js";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const GROUP_STAGE_MATCH_COUNT = Object.keys(GROUPS).length * 6;
const KNOCKOUT_PHASES = {
  "round-of-32": { label: "Round of 32", shortLabel: "R32", order: 1 },
  "round-of-16": { label: "Round of 16", shortLabel: "R16", order: 2 },
  quarterfinals: { label: "準々決勝", tokenLabel: "Quarterfinal", shortLabel: "QF", order: 3 },
  semifinals: { label: "準決勝", tokenLabel: "Semifinal", shortLabel: "SF", order: 4 },
  "3rd-place-match": { label: "3位決定戦", shortLabel: "3rd", order: 5 },
  final: { label: "決勝", shortLabel: "Final", order: 6 },
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
  const venue = competition?.venue ?? event.venue ?? {};
  return {
    id: event.id,
    date: event.date,
    phase: event.season?.slug ?? "",
    completed: event.status?.type?.completed === true,
    status: event.status?.type?.shortDetail ?? event.status?.type?.description ?? "",
    venue: venue.fullName ?? venue.displayName ?? "",
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

function isKnockoutMatch(match) {
  return Boolean(KNOCKOUT_PHASES[match.phase]);
}

function knockoutPhaseLabel(phase) {
  return KNOCKOUT_PHASES[phase]?.label ?? phase;
}

function knockoutPhaseTokenLabel(phase) {
  return KNOCKOUT_PHASES[phase]?.tokenLabel ?? KNOCKOUT_PHASES[phase]?.label ?? phase;
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

function groupStageMatchesCompleted(matches) {
  const matchesInGroups = groupMatches(matches);
  return matchesInGroups.length >= GROUP_STAGE_MATCH_COUNT && matchesInGroups.every((match) => match.completed);
}

function thirdPlaceRanking(standings) {
  return Object.entries(standings)
    .map(([group, rows]) => ({ group, ...rows[2] }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group));
}

function qualificationState(standings, matches) {
  const groupComplete = groupStageMatchesCompleted(matches);
  const thirdRanking = thirdPlaceRanking(standings);
  const thirdQualifiedTeams = new Set(thirdRanking.slice(0, 8).map((row) => row.team));
  const qualifiedTeams = new Set();

  for (const rows of Object.values(standings)) {
    rows.slice(0, 2).forEach((row) => qualifiedTeams.add(row.team));
  }
  thirdQualifiedTeams.forEach((team) => qualifiedTeams.add(team));

  return { groupComplete, thirdRanking, thirdQualifiedTeams, qualifiedTeams };
}

function rankMark(rank) {
  if (rank <= 2) return "🟢";
  if (rank === 3) return "🟡";
  return "⚫";
}

function finalRankMark(row, rank, state) {
  if (!state.groupComplete) return rankMark(rank);
  return state.qualifiedTeams.has(row.team) ? "🟢" : "⚫";
}

function finalRankStatus(row, rank, state) {
  if (!state.groupComplete) return "";
  if (rank <= 2) return " / 通過";
  if (state.thirdQualifiedTeams.has(row.team)) return " / 3位通過";
  return " / 敗退";
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

function teamWon(match, side) {
  const team = match[side];
  const opponent = side === "home" ? match.away : match.home;
  return match.completed && team.score > opponent.score;
}

function winnerTeam(match) {
  if (!match.completed || match.home.score === match.away.score) return null;
  return match.home.score > match.away.score ? match.home : match.away;
}

function loserTeam(match) {
  if (!match.completed || match.home.score === match.away.score) return null;
  return match.home.score > match.away.score ? match.away : match.home;
}

function isKnownTeamName(name) {
  return Object.values(GROUPS).flat().includes(canonicalTeamName(name));
}

function placeholderLabel(name) {
  return String(name ?? "")
    .replace(/Round of 32 (\d+) Winner/g, "R32第$1試合 勝者")
    .replace(/Round of 16 (\d+) Winner/g, "R16第$1試合 勝者")
    .replace(/Quarterfinal (\d+) Winner/g, "準々決勝第$1試合 勝者")
    .replace(/Semifinal (\d+) Winner/g, "準決勝第$1試合 勝者")
    .replace(/Semifinal (\d+) Loser/g, "準決勝第$1試合 敗者");
}

function teamWithRankIfKnown(teamName) {
  if (isKnownTeamName(teamName)) return teamWithRank(canonicalTeamName(teamName));
  return `**${placeholderLabel(teamName)}**`;
}

function knockoutMatches(matches) {
  return matches
    .filter(isKnockoutMatch)
    .sort((a, b) => KNOCKOUT_PHASES[a.phase].order - KNOCKOUT_PHASES[b.phase].order || new Date(a.date) - new Date(b.date));
}

function phaseMatchNumbers(matches) {
  const byPhase = new Map();
  for (const match of knockoutMatches(matches)) {
    if (!byPhase.has(match.phase)) byPhase.set(match.phase, []);
    byPhase.get(match.phase).push(match);
  }

  const numbers = new Map();
  for (const phaseMatches of byPhase.values()) {
    phaseMatches
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((match, index) => numbers.set(match.id, index + 1));
  }
  return numbers;
}

function advancementToken(match, numbers, outcome = "Winner") {
  const number = numbers.get(match.id);
  if (!number) return "";
  return `${knockoutPhaseTokenLabel(match.phase)} ${number} ${outcome}`;
}

function matchTeamNames(match) {
  return [match.home.name, match.away.name].filter(Boolean);
}

function findAdvancementMatch(matches, match, numbers, outcome = "Winner") {
  const token = advancementToken(match, numbers, outcome);
  const concreteTeam = outcome === "Winner" ? winnerTeam(match) : loserTeam(match);
  const afterTime = new Date(match.date).getTime();
  return knockoutMatches(matches).find((candidate) => {
    if (new Date(candidate.date).getTime() <= afterTime) return false;
    const names = matchTeamNames(candidate);
    return (token && names.includes(token)) || (concreteTeam && names.includes(concreteTeam.name));
  }) ?? null;
}

function formatKnockoutScore(match) {
  if (match.completed) {
    const homeMarker = teamWon(match, "home") ? " ✅" : "";
    const awayMarker = teamWon(match, "away") ? " ✅" : "";
    return `${teamWithRankIfKnown(match.home.name)}${homeMarker} ${match.home.score}-${match.away.score} ${teamWithRankIfKnown(match.away.name)}${awayMarker}`;
  }
  return `${teamWithRankIfKnown(match.home.name)} vs ${teamWithRankIfKnown(match.away.name)}（${statusLabel(match.status) || "未開催"}）`;
}

function formatKnockoutMatchLine(match, numbers, matches, { includeNext = true } = {}) {
  const date = `${displayDateInTokyo(ymdInTokyo(new Date(match.date)))} ${hmInTokyo(match.date)}`;
  const number = numbers.get(match.id);
  const prefix = number ? `第${number}試合` : knockoutPhaseLabel(match.phase);
  const venue = match.venue ? ` / ${match.venue}` : "";
  const next = includeNext && match.completed ? findAdvancementMatch(matches, match, numbers, "Winner") : null;
  const nextLine = next ? `\n> 勝者の次戦: ${displayDateInTokyo(ymdInTokyo(new Date(next.date)))} ${hmInTokyo(next.date)} ${teamWithRankIfKnown(next.home.name)} vs ${teamWithRankIfKnown(next.away.name)}` : "";
  return `• **${prefix} ${date}**${venue}\n  ${formatKnockoutScore(match)}${nextLine}`;
}

function chunkPayloads(title, lines, maxLength = 1800) {
  const payloads = [];
  let current = title;
  for (const line of lines) {
    const next = `${current}\n${line}`;
    if (next.length > maxLength && current !== title) {
      payloads.push({ content: current, allowed_mentions: { parse: [] } });
      current = `${title}（続き）\n${line}`;
    } else {
      current = next;
    }
  }
  payloads.push({ content: current, allowed_mentions: { parse: [] } });
  return payloads;
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

function formatGroup(group, rows, state) {
  return [
    `## Group ${group}`,
    ...rows.map((row, index) => {
      const rank = index + 1;
      const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
      return `${finalRankMark(row, rank, state)} **${rank}. ${teamLabel(row.team)}**  ${row.pts}pt  ${row.played}試合  ${row.won}勝${row.drawn}分${row.lost}敗  得失${gd}${finalRankStatus(row, rank, state)}`;
    }),
  ].join("\n");
}

function standingsPayload(title, standings, groups, state) {
  const legend = state.groupComplete
    ? "🟢 通過　⚫ 敗退"
    : "🟢 1〜2位: 自動突破圏　🟡 3位: 通過争い　⚫ 4位: 厳しい";
  return {
    content: [
      `${title}\n${legend}`,
      ...groups.map((group) => formatGroup(group, standings[group], state)),
    ].join("\n\n"),
    allowed_mentions: { parse: [] },
  };
}

export async function buildStandingsPayloads() {
  await refreshFifaRankings();
  const matches = await allMatches();
  const standings = calculateStandings(matches);
  const state = qualificationState(standings, matches);
  return [
    standingsPayload("# 📊 Groups A-D", standings, ["A", "B", "C", "D"], state),
    standingsPayload("# 📊 Groups E-H", standings, ["E", "F", "G", "H"], state),
    standingsPayload("# 📊 Groups I-L", standings, ["I", "J", "K", "L"], state),
  ];
}

export async function buildGroupStandingsPayloads(group) {
  await refreshFifaRankings();
  const normalizedGroup = String(group ?? "").trim().toUpperCase();
  if (!GROUPS[normalizedGroup]) {
    throw new Error("グループは A〜L のいずれかで指定してください。");
  }
  const matches = await allMatches();
  const standings = calculateStandings(matches);
  const state = qualificationState(standings, matches);
  return [{
    content: [
      `# 📊 Group ${normalizedGroup}`,
      state.groupComplete ? "🟢 通過　⚫ 敗退" : "🟢 1〜2位: 自動突破圏　🟡 3位: 通過争い　⚫ 4位: 厳しい",
      "",
      ...standings[normalizedGroup].map((row, index) => {
        const rank = index + 1;
        const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
        return `${finalRankMark(row, rank, state)} **${rank}. ${teamLabel(row.team)}**  ${row.pts}pt  ${row.played}試合  ${row.won}勝${row.drawn}分${row.lost}敗  得失${gd}${finalRankStatus(row, rank, state)}`;
      }),
    ].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}

function formatQualifiedGroupLine(group, rows, state) {
  const automatic = rows.slice(0, 2).map((row, index) => `${index + 1}位 ${teamLabel(row.team)}`).join(" / ");
  const third = rows[2];
  const thirdStatus = state.thirdQualifiedTeams.has(third.team) ? "3位通過" : "敗退";
  return `• **Group ${group}** ${automatic} / 3位 ${teamLabel(third.team)}（${thirdStatus}）`;
}

export async function buildQualifiedPayloads() {
  await refreshFifaRankings();
  const matches = await allMatches();
  const standings = calculateStandings(matches);
  const state = qualificationState(standings, matches);
  const header = state.groupComplete
    ? "# ✅ 決勝トーナメント進出チーム"
    : "# ✅ 現時点の決勝トーナメント進出圏";
  const thirdTeams = state.thirdRanking.slice(0, 8).map((row) => teamLabel(row.team)).join("、");
  return [{
    content: [
      header,
      "各組1〜2位と、3位上位8チームがRound of 32へ進出します。",
      "",
      ...Object.entries(standings).map(([group, rows]) => formatQualifiedGroupLine(group, rows, state)),
      "",
      `**3位通過圏:** ${thirdTeams}`,
    ].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}

function formatThirdPlaceRow(row, index, state) {
  const rank = index + 1;
  const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
  const mark = rank <= 8 ? "🟢" : "⚫";
  const status = state.groupComplete ? (rank <= 8 ? "通過" : "敗退") : (rank <= 8 ? "通過圏" : "圏外");
  return `${mark} **${rank}. Group ${row.group} ${teamLabel(row.team)}**  ${row.pts}pt  得失${gd}  得点${row.gf} / ${status}`;
}

export async function buildThirdPlacePayloads() {
  await refreshFifaRankings();
  const matches = await allMatches();
  const standings = calculateStandings(matches);
  const state = qualificationState(standings, matches);
  return [{
    content: [
      "# 🟡 3位チームランキング",
      state.groupComplete ? "上位8チームがRound of 32へ進出しました。" : "現時点の上位8チームが通過圏です。",
      "",
      ...state.thirdRanking.map((row, index) => formatThirdPlaceRow(row, index, state)),
    ].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}

export async function buildBracketPayloads(phase = "") {
  await refreshFifaRankings();
  const matches = await allMatches();
  const numbers = phaseMatchNumbers(matches);
  const normalizedPhase = String(phase ?? "").trim();
  const phases = normalizedPhase && KNOCKOUT_PHASES[normalizedPhase]
    ? [normalizedPhase]
    : Object.keys(KNOCKOUT_PHASES);

  const payloads = [];
  for (const phaseKey of phases) {
    const phaseMatches = knockoutMatches(matches)
      .filter((match) => match.phase === phaseKey)
      .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
    if (phaseMatches.length === 0) continue;
    const title = `# 🏆 ${knockoutPhaseLabel(phaseKey)}`;
    const lines = phaseMatches.map((match) => formatKnockoutMatchLine(match, numbers, matches));
    payloads.push(...chunkPayloads(title, lines));
  }

  return payloads.length ? payloads : [{
    content: "# 🏆 決勝トーナメント\n該当する試合が見つかりませんでした。",
    allowed_mentions: { parse: [] },
  }];
}

function formatEliminationLine(match, numbers, matches) {
  const winner = winnerTeam(match);
  const loser = loserTeam(match);
  if (!winner || !loser) return null;
  const next = findAdvancementMatch(matches, match, numbers, "Winner");
  const nextLabel = next
    ? ` / 次戦: ${displayDateInTokyo(ymdInTokyo(new Date(next.date)))} ${hmInTokyo(next.date)}`
    : "";
  return `• ${teamLabel(winner.name)}が${teamLabel(loser.name)}を下して勝ち上がり${nextLabel}`;
}

function nextKnockoutMatches(matches, afterDate, limit = 4) {
  const afterTime = afterDate.getTime();
  return knockoutMatches(matches)
    .filter((match) => !match.completed && new Date(match.date).getTime() >= afterTime)
    .slice(0, limit);
}

export async function buildKnockoutProgressPayloads(targetDate = todayInTokyo()) {
  await refreshFifaRankings();
  const matches = await allMatches();
  const numbers = phaseMatchNumbers(matches);
  const targetMatches = knockoutMatches(matches)
    .filter((match) => ymdInTokyo(new Date(match.date)) === targetDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const completedLines = targetMatches
    .filter((match) => match.completed)
    .map((match) => formatEliminationLine(match, numbers, matches))
    .filter(Boolean);
  const upcomingLines = nextKnockoutMatches(matches, new Date(`${targetDate}T00:00:00+09:00`))
    .map((match) => formatKnockoutMatchLine(match, numbers, matches, { includeNext: false }));

  return [{
    content: [
      "# 🏆 決勝トーナメント進行",
      completedLines.length ? "**今日決まったこと**" : "**今日決まったこと**\nこの日の決勝トーナメント確定結果はありません。",
      ...completedLines,
      "",
      "**次のカード**",
      ...(upcomingLines.length ? upcomingLines : ["該当する今後のカードはありません。"]),
    ].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}

export async function buildDailySummaryPayloads(targetDate = todayInTokyo()) {
  const matches = await allMatches();
  const standings = calculateStandings(matches);
  const state = qualificationState(standings, matches);
  if (state.groupComplete) {
    return [...(await buildResultsPayloads(targetDate)), ...(await buildKnockoutProgressPayloads(targetDate))];
  }
  return [...(await buildResultsPayloads(targetDate)), ...(await buildStandingsPayloads())];
}

function formatPotentialNextMatchLine(matches, match, numbers) {
  const next = findAdvancementMatch(matches, match, numbers, "Winner");
  if (!next) return "";
  const ownToken = advancementToken(match, numbers, "Winner");
  const home = next.home.name === ownToken ? "**この試合の勝者**" : teamWithRankIfKnown(next.home.name);
  const away = next.away.name === ownToken ? "**この試合の勝者**" : teamWithRankIfKnown(next.away.name);
  return `• **勝った場合の次戦** ${displayDateInTokyo(ymdInTokyo(new Date(next.date)))} ${hmInTokyo(next.date)} ${home} vs ${away}`;
}

function formatTeamTournamentStatus(team, matches) {
  const completed = matches
    .filter((match) => match.completed && (match.home.name === team || match.away.name === team))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const last = completed.at(-1);
  if (!last || !isKnockoutMatch(last)) return "";
  const winner = winnerTeam(last);
  const loser = loserTeam(last);
  if (winner?.name === team && last.phase === "final") return `• **大会結果** ${teamLabel(team)}が決勝を制しました。`;
  if (loser?.name === team) {
    return `• **大会結果** ${knockoutPhaseLabel(last.phase)}で敗退: ${formatTeamMatchLine(last)}`;
  }
  return "";
}

export async function buildTeamSchedulePayloads(teamQuery, scope = "all") {
  await refreshFifaRankings();
  const team = canonicalTeamName(teamQuery || "Japan");
  const all = await allMatches();
  const numbers = phaseMatchNumbers(all);
  let matches = all
    .filter((match) => match.home.name === team || match.away.name === team)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const today = todayInTokyo();
  if (scope === "today") matches = matches.filter((match) => ymdInTokyo(new Date(match.date)) === today);
  if (scope === "future") matches = matches.filter((match) => new Date(match.date) >= new Date());

  const lines = matches.length ? matches.map(formatTeamMatchLine) : ["該当する試合はありません。"];
  if (scope === "future" && matches[0] && isKnockoutMatch(matches[0])) {
    const nextLine = formatPotentialNextMatchLine(all, matches[0], numbers);
    if (nextLine) lines.push("", nextLine);
  }
  if (scope === "future" && matches.length === 0) {
    const statusLine = formatTeamTournamentStatus(team, all);
    if (statusLine) lines.push("", statusLine);
  }
  return [{
    content: [`# 🇯🇵 ${teamLabel(team)}戦`, "", ...lines].join("\n"),
    allowed_mentions: { parse: [] },
  }];
}
