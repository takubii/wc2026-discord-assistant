import { canonicalTeamName, teamLabel } from "./team-data.js";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

function hmInTokyo(dateString) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateString));
}

function displayDateInTokyo(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

async function fetchScoreboardEvents() {
  const res = await fetch(ESPN_SCOREBOARD_URL);
  if (!res.ok) throw new Error(`ESPN scoreboard error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.events ?? [];
}

async function fetchSummary(eventId) {
  const res = await fetch(`${ESPN_SUMMARY_URL}${encodeURIComponent(eventId)}`);
  if (!res.ok) throw new Error(`ESPN summary error: ${res.status} ${res.statusText}`);
  return res.json();
}

function competitors(event) {
  return event.competitions?.[0]?.competitors ?? [];
}

function teamNames(event) {
  return competitors(event).map((competitor) => competitor.team?.displayName ?? competitor.team?.name ?? "TBD");
}

function isConcreteMatch(event) {
  return teamNames(event).every((name) => name && !/Winner|Place|Third Place|Quarterfinal|Semifinal|Round of/i.test(name));
}

function findTargetEvent(events, teamQuery = "") {
  const team = canonicalTeamName(teamQuery);
  const now = Date.now();
  const lowerBound = now - 2 * 60 * 60 * 1000;
  const matches = events
    .filter(isConcreteMatch)
    .filter((event) => {
      if (!team) return true;
      return teamNames(event).includes(team);
    })
    .filter((event) => new Date(event.date).getTime() >= lowerBound)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return matches[0] ?? null;
}

function normalizeRosterPlayer(player) {
  return {
    name: player.athlete?.displayName ?? player.athlete?.shortName ?? "TBD",
    positionAbbreviation: player.position?.abbreviation ?? player.position?.name ?? "",
  };
}

function parseOfficialLineups(summary) {
  return (summary.rosters ?? [])
    .filter((teamRoster) => Array.isArray(teamRoster.roster))
    .map((teamRoster) => {
      const players = teamRoster.roster.map(normalizeRosterPlayer);
      return {
        teamName: teamRoster.team?.displayName ?? teamRoster.team?.name ?? "TBD",
        formation: teamRoster.formation ?? "",
        starters: teamRoster.roster.filter((player) => player.starter).map(normalizeRosterPlayer),
        substitutes: teamRoster.roster.filter((player) => !player.starter).map(normalizeRosterPlayer),
        players,
      };
    })
    .filter((teamRoster) => teamRoster.starters.length >= 11);
}

function eventTitle(event) {
  const names = teamNames(event).map(teamLabel);
  return `${names[0] ?? "TBD"} vs ${names[1] ?? "TBD"}`;
}

function eventMeta(event) {
  return `${displayDateInTokyo(event.date)} ${hmInTokyo(event.date)} JST`;
}

function positionLabel(player) {
  return player.positionAbbreviation ? `[${player.positionAbbreviation}] ` : "";
}

function formatPlayerList(players) {
  return players.map((player) => `• ${positionLabel(player)}${player.name}`).join("\n");
}

function formatLineup(lineup) {
  const substitutes = lineup.substitutes.slice(0, 15);
  return [
    `## ${teamLabel(lineup.teamName)} ${lineup.formation ? `(${lineup.formation})` : ""}`.trim(),
    "",
    "**先発**",
    formatPlayerList(lineup.starters),
    "",
    "**控え**",
    substitutes.length ? formatPlayerList(substitutes) : "不明",
  ].join("\n");
}

export async function buildLineupPayload(teamQuery = "") {
  const event = findTargetEvent(await fetchScoreboardEvents(), teamQuery);
  if (!event) {
    const suffix = teamQuery ? `（${teamQuery}）` : "";
    return {
      content: `対象の試合が見つかりませんでした${suffix}。`,
      allowed_mentions: { parse: [] },
    };
  }

  const summary = await fetchSummary(event.id);
  const lineups = parseOfficialLineups(summary);
  const contentHeader = [`# ${eventTitle(event)}`, `${eventMeta(event)} / 公式スタメン`];

  if (lineups.length < 2) {
    return {
      content: [
        `# ${eventTitle(event)}`,
        `${eventMeta(event)}`,
        "",
        "公式スタメンはまだ発表されていません。",
        "通常は試合開始の約1時間前に公開されます。",
      ].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }

  return {
    content: [
      ...contentHeader,
      "",
      ...lineups.slice(0, 2).map(formatLineup),
    ].join("\n\n"),
    allowed_mentions: { parse: [] },
  };
}
