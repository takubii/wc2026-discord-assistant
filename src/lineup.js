import { buildLineupSvg, buildMatchLineupSvg, renderLineupPng } from "./lineup-renderer.js";
import { canonicalTeamName, teamLabel } from "./team-data.js";
import { formatFifaRankLine } from "./fifa-rankings.js";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

const FLAG_CODES = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia-Herzegovina": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  "Congo DR": "cd",
  Croatia: "hr",
  "Curaçao": "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Türkiye: "tr",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
};

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

function imageDateInTokyo(dateString) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString));
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

function eventTitleEn(event) {
  const names = teamNames(event);
  return `${names[0] ?? "TBD"} vs ${names[1] ?? "TBD"}`;
}

function eventMeta(event) {
  return `${displayDateInTokyo(event.date)} ${hmInTokyo(event.date)} JST`;
}

function imageEventMeta(event) {
  return `${imageDateInTokyo(event.date)} ${hmInTokyo(event.date)} JST`;
}

function eventRankLine(event) {
  const [homeName, awayName] = teamNames(event);
  return formatFifaRankLine(homeName, awayName);
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

function slug(value) {
  return String(value ?? "team").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function imageUrl(baseUrl, event, lineup) {
  const url = new URL("/lineup-image", baseUrl);
  url.searchParams.set("event", event.id);
  if (lineup?.teamName) url.searchParams.set("team", lineup.teamName);
  url.searchParams.set("v", "3");
  return url.toString();
}

function attachmentImageEmbed(event, filename) {
  return {
    title: eventTitle(event),
    color: 0x0b7a43,
    image: { url: `attachment://${filename}` },
  };
}

function lineupImageEmbed(baseUrl, event) {
  return {
    title: eventTitle(event),
    color: 0x0b7a43,
    image: { url: imageUrl(baseUrl, event) },
  };
}

function lineupSummary(lineup) {
  return `• **${teamLabel(lineup.teamName)}** ${lineup.formation || "formation TBD"}`;
}

async function eventWithLineups(eventId, teamQuery = "") {
  const events = await fetchScoreboardEvents();
  const event = eventId ? events.find((candidate) => candidate.id === eventId) : findTargetEvent(events, teamQuery);
  if (!event) {
    return { event: null, lineups: [] };
  }
  const summary = await fetchSummary(event.id);
  return { event, lineups: parseOfficialLineups(summary) };
}

export async function buildLineupPayload(teamQuery = "", options = {}) {
  const { event, lineups } = await eventWithLineups("", teamQuery);
  if (!event) {
    const suffix = teamQuery ? `（${teamQuery}）` : "";
    return {
      content: `対象の試合が見つかりませんでした${suffix}。`,
      allowed_mentions: { parse: [] },
    };
  }

  const contentHeader = [`# ${eventTitle(event)}`, `${eventMeta(event)} / 公式スタメン`, eventRankLine(event)];

  if (lineups.length < 2) {
    return {
      content: [
        `# ${eventTitle(event)}`,
        `${eventMeta(event)}`,
        eventRankLine(event),
        "",
        "公式スタメンはまだ発表されていません。",
        "通常は試合開始の約1時間前に公開されます。",
      ].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }

  if (options.summaryOnly) {
    return {
      content: [
        ...contentHeader,
        "",
        ...lineups.slice(0, 2).map(lineupSummary),
        "",
        "スタメン画像を生成しています。",
      ].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }

  if (options.attachImage) {
    const image = await buildLineupImage(event.id);
    return {
      content: [
        ...contentHeader,
        "",
        ...lineups.slice(0, 2).map(lineupSummary),
      ].join("\n"),
      allowed_mentions: { parse: [] },
      embeds: [attachmentImageEmbed(event, image.filename)],
      files: [{
        name: image.filename,
        type: "image/png",
        data: image.data,
      }],
    };
  }

  if (options.imageBaseUrl) {
    return {
      content: [
        ...contentHeader,
        "",
        ...lineups.slice(0, 2).map(lineupSummary),
        "",
        "画像を読み込めない場合は、少し待ってからもう一度実行してください。",
      ].join("\n"),
      allowed_mentions: { parse: [] },
      embeds: [lineupImageEmbed(options.imageBaseUrl, event)],
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

export async function buildLineupImagePayload(teamQuery = "") {
  const { event, lineups } = await eventWithLineups("", teamQuery);
  if (!event || lineups.length < 2) return null;

  const image = await buildLineupImage(event.id);
  return {
    content: `${eventTitle(event)} のスタメン画像です。`,
    allowed_mentions: { parse: [] },
    embeds: [attachmentImageEmbed(event, image.filename)],
    files: [{
      name: image.filename,
      type: "image/png",
      data: image.data,
    }],
  };
}

export async function buildLineupImage(eventId, teamName) {
  if (!eventId) {
    throw new Error("event query parameter is required");
  }

  const { event, lineups } = await eventWithLineups(eventId);
  if (!event || lineups.length < 2) {
    throw new Error("official lineups are not available");
  }

  if (!teamName) {
    const data = await withTimeout(renderLineupPng(buildMatchLineupSvg({
      title: eventTitleEn(event),
      kickoffLabel: imageEventMeta(event),
      lineups: lineups.slice(0, 2).map((lineup) => {
        const opponentName = lineups.find((candidate) => candidate.teamName !== lineup.teamName)?.teamName ?? "";
        return {
          teamName: lineup.teamName,
          opponentName,
          formation: lineup.formation,
          kickoffLabel: `${hmInTokyo(event.date)} JST`,
          starters: lineup.starters,
          substitutes: lineup.substitutes,
          flagUrl: teamFlagUrl(lineup.teamName),
          flagCode: flagCode(lineup.teamName),
        };
      }),
    }), 1800), 8000, "PNG render timeout");
    return {
      filename: `${event.id}-lineups.png`,
      data,
    };
  }

  const lineup = lineups.find((candidate) => candidate.teamName === teamName || canonicalTeamName(candidate.teamName) === canonicalTeamName(teamName));
  if (!lineup) {
    throw new Error(`lineup not found for ${teamName}`);
  }

  const opponentName = lineups.find((candidate) => candidate.teamName !== lineup.teamName)?.teamName ?? "";
  const svg = buildLineupSvg({
    teamName: lineup.teamName,
    opponentName,
    formation: lineup.formation,
    kickoffLabel: `${hmInTokyo(event.date)} JST`,
    starters: lineup.starters,
    substitutes: lineup.substitutes,
    flagUrl: teamFlagUrl(lineup.teamName),
    flagCode: flagCode(lineup.teamName),
  });
  const data = await withTimeout(renderLineupPng(svg), 8000, "PNG render timeout");
  return {
    filename: `${slug(lineup.teamName)}-lineup.png`,
    data,
  };
}

function flagCode(teamName) {
  return FLAG_CODES[canonicalTeamName(teamName)] ?? "";
}

function teamFlagUrl(teamName) {
  const code = flagCode(teamName);
  return code ? `https://flagcdn.com/w80/${code}.png` : "";
}
