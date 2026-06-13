import { buildLineupSvg, buildMatchLineupSvg, renderLineupPng } from "./lineup-renderer.js";
import { buildLineupLayout } from "./lineup-ai-layout.js";
import { playerNameLabel } from "./lineup-name-ja.js";
import { canonicalTeamName, normalizeText, teamLabel } from "./team-data.js";
import { formatFifaRankLine } from "./fifa-rankings.js";
import { findPlayerMetadata, formatAge, formatClub, formatShirtNumber } from "./player-data.js";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";
const ESPN_MATCH_URL = "https://www.espn.com/soccer/match/_/gameId/";

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

async function fetchMatchPage(eventId) {
  const res = await fetch(`${ESPN_MATCH_URL}${encodeURIComponent(eventId)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`ESPN match page error: ${res.status} ${res.statusText}`);
  return res.text();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeName(value) {
  return normalizeText(value).split(" ").filter(Boolean).join(" ");
}

function nameTokenKey(name) {
  return normalizeName(name).split(" ").sort().join(" ");
}

function matchPlayerByName(players, name) {
  const normalized = normalizeName(name);
  const tokenKey = nameTokenKey(name);
  return (
    players.find((player) => normalizeName(player.name) === normalized) ??
    players.find((player) => nameTokenKey(player.name) === tokenKey) ??
    players.find((player) => normalizeName(player.name).includes(normalized) || normalized.includes(normalizeName(player.name))) ??
    null
  );
}

function parseMatchPageFormations(html) {
  const players = [];
  const anchorPattern = /<a\b[^>]*data-track-event_detail="lineups &amp; formation:player click"[^>]*>/g;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const anchor = match[0];
    const name = decodeHtml(anchor.match(/data-track-athlete="([^"]+)"/)?.[1]);
    const teamName = decodeHtml(anchor.match(/data-track-teamname="([^"]+)"/)?.[1]);
    if (!name || !teamName) continue;

    const before = html.slice(Math.max(0, match.index - 900), match.index);
    const style = [...before.matchAll(/style="([^"]*left:\s*[\d.]+%;[^"]*top:\s*[\d.]+%[^"]*)"/g)].at(-1)?.[1] ?? "";
    const x = Number(style.match(/left:\s*([\d.]+)%/)?.[1]);
    const y = Number(style.match(/top:\s*([\d.]+)%/)?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    players.push({ teamName, name, x, y });
  }

  const unique = new Map();
  for (const player of players) {
    unique.set(`${canonicalTeamName(player.teamName)}|${normalizeName(player.name)}|${player.x}|${player.y}`, player);
  }
  return [...unique.values()];
}

function pitchPoint({ x, y }) {
  return {
    x: Math.round(94 + x * 7.12),
    y: Math.round(178 + y * 7.82),
  };
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

function parseRosterNumber(value) {
  const number = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseFormationCounts(formation) {
  const counts = String(formation ?? "")
    .match(/\d+/g)
    ?.map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 5);
  return counts?.reduce((sum, value) => sum + value, 0) === 10 ? counts : null;
}

function labelsForRow(rowIndex, rowCount, formationCounts) {
  const isDefense = rowIndex === 0;
  const isAttack = rowIndex === formationCounts.length - 1;
  const isAttackingMidfield = rowIndex === formationCounts.length - 2 && formationCounts.at(-1) === 1;

  if (isDefense) {
    return {
      3: ["LCB", "CB", "RCB"],
      4: ["LB", "LCB", "RCB", "RB"],
      5: ["LWB", "LCB", "CB", "RCB", "RWB"],
    }[rowCount] ?? Array.from({ length: rowCount }, (_, index) => `D${index + 1}`);
  }

  if (isAttack) {
    return {
      1: ["CF"],
      2: ["LCF", "RCF"],
      3: ["LW", "CF", "RW"],
    }[rowCount] ?? Array.from({ length: rowCount }, (_, index) => `F${index + 1}`);
  }

  if (isAttackingMidfield) {
    return {
      2: ["LAM", "RAM"],
      3: ["LW", "CAM", "RW"],
      4: ["LM", "LAM", "RAM", "RM"],
    }[rowCount] ?? Array.from({ length: rowCount }, (_, index) => `AM${index + 1}`);
  }

  return {
    1: ["CM"],
    2: rowIndex === 1 ? ["LDM", "RDM"] : ["LCM", "RCM"],
    3: ["LCM", "CM", "RCM"],
    4: ["LM", "LCM", "RCM", "RM"],
    5: ["LM", "LCM", "CM", "RCM", "RM"],
  }[rowCount] ?? Array.from({ length: rowCount }, (_, index) => `M${index + 1}`);
}

function applyFormationPositions(starters, formation) {
  const counts = parseFormationCounts(formation);
  const withCoordinates = starters.filter((player) => Number.isFinite(player.formationX) && Number.isFinite(player.formationY));
  if (!counts || withCoordinates.length !== 11) return starters;

  const goalkeeper = withCoordinates.reduce((best, player) => (player.formationY > best.formationY ? player : best));
  goalkeeper.positionAbbreviation = "GK";

  const outfield = withCoordinates
    .filter((player) => player !== goalkeeper)
    .sort((a, b) => b.formationY - a.formationY || a.formationX - b.formationX);

  let offset = 0;
  counts.forEach((count, rowIndex) => {
    const row = outfield.slice(offset, offset + count).sort((a, b) => a.formationX - b.formationX);
    const labels = labelsForRow(rowIndex, count, counts);
    row.forEach((player, index) => {
      player.positionAbbreviation = labels[index] ?? player.positionAbbreviation;
    });
    offset += count;
  });

  return starters;
}

function normalizeRosterPlayer(player) {
  return {
    name: player.athlete?.displayName ?? player.athlete?.shortName ?? "TBD",
    positionAbbreviation: player.position?.abbreviation ?? player.position?.name ?? "",
    shirtNumber: parseRosterNumber(player.jersey ?? player.athlete?.jersey),
  };
}

function enrichRosterPlayer(player, teamName) {
  const metadata = findPlayerMetadata(teamName, player.name);
  return {
    ...player,
    shirtNumber: player.shirtNumber ?? metadata?.shirtNumber ?? null,
    age: metadata?.age ?? null,
    club: metadata?.club ?? null,
  };
}

function applyMatchPageFormation(lineup, formationPlayers) {
  const teamName = canonicalTeamName(lineup.teamName);
  const teamFormationPlayers = formationPlayers.filter((player) => canonicalTeamName(player.teamName) === teamName);
  if (teamFormationPlayers.length < 11) return lineup;

  const starters = lineup.starters.map((starter) => {
    const formationPlayer = matchPlayerByName(teamFormationPlayers, starter.name);
    if (!formationPlayer) return starter;
    return {
      ...starter,
      formationX: formationPlayer.x,
      formationY: formationPlayer.y,
    };
  });
  applyFormationPositions(starters, lineup.formation);

  if (starters.some((player) => !Number.isFinite(player.formationX) || !Number.isFinite(player.formationY))) {
    return { ...lineup, starters };
  }

  return {
    ...lineup,
    starters,
    formationLayout: starters.map((player) => ({
      ...pitchPoint({ x: player.formationX, y: player.formationY }),
      pos: player.positionAbbreviation,
      width: player.positionAbbreviation === "GK" ? 208 : 176,
      name: player.name,
      shirtNumber: player.shirtNumber,
    })),
  };
}

function parseOfficialLineups(summary, formationPlayers = []) {
  return (summary.rosters ?? [])
    .filter((teamRoster) => Array.isArray(teamRoster.roster))
    .map((teamRoster) => {
      const teamName = teamRoster.team?.displayName ?? teamRoster.team?.name ?? "TBD";
      const players = teamRoster.roster.map(normalizeRosterPlayer);
      return {
        teamName,
        formation: teamRoster.formation ?? "",
        starters: teamRoster.roster.filter((player) => player.starter).map(normalizeRosterPlayer).map((player) => enrichRosterPlayer(player, teamName)),
        substitutes: teamRoster.roster.filter((player) => !player.starter).map(normalizeRosterPlayer).map((player) => enrichRosterPlayer(player, teamName)),
        players: players.map((player) => enrichRosterPlayer(player, teamName)),
      };
    })
    .map((lineup) => applyMatchPageFormation(lineup, formationPlayers))
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

function lineupPlayerNumber(player) {
  return formatShirtNumber(player);
}

function lineupPlayerAge(player) {
  const age = formatAge(player);
  return age ? ` / ${age}` : "";
}

function lineupPlayerClub(player) {
  return player.club ? ` / ${formatClub(player)}` : "";
}

function lineupPlayerName(player, { japanese = false, includeAge = false, includeClub = false } = {}) {
  const name = japanese ? playerNameLabel(player.name) : player.name;
  return `${lineupPlayerNumber(player)}${name}${includeAge ? lineupPlayerAge(player) : ""}${includeClub ? lineupPlayerClub(player) : ""}`;
}

function detailedPositionLabel(position) {
  const labels = {
    G: "GK",
    CD: "CB",
    "CD-L": "CB-L",
    "CD-R": "CB-R",
    F: "CF",
  };
  return labels[position] ?? position ?? "";
}

function positionGroup(position) {
  if (["G", "GK"].includes(position)) return "GK";
  if (["LB", "LWB", "RB", "RWB", "CD", "CB", "LCB", "RCB", "CD-L", "CB-L", "CD-R", "CB-R"].includes(position)) return "DF";
  if (["DM", "CDM", "LDM", "RDM", "CM", "LCM", "RCM", "CM-L", "CM-R", "LM", "RM", "AM", "LAM", "RAM", "CAM"].includes(position)) return "MF";
  return "FW";
}

function positionSortValue(position) {
  const order = {
    GK: 0,
    G: 0,
    LWB: 10,
    LB: 11,
    LCB: 12,
    "CB-L": 12,
    "CD-L": 12,
    CB: 13,
    CD: 13,
    RCB: 14,
    "CB-R": 14,
    "CD-R": 14,
    RB: 15,
    RWB: 16,
    LDM: 20,
    DM: 21,
    CDM: 21,
    RDM: 22,
    LM: 30,
    LCM: 31,
    "CM-L": 31,
    CM: 32,
    RCM: 33,
    "CM-R": 33,
    RM: 34,
    LAM: 40,
    AM: 41,
    CAM: 41,
    RAM: 42,
    LW: 50,
    LF: 50,
    LCF: 51,
    CF: 52,
    F: 52,
    RCF: 53,
    RW: 54,
    RF: 54,
  };
  return order[position] ?? 99;
}

function formatPlayerList(players) {
  return players.map((player) => `• ${positionLabel(player)}${lineupPlayerName(player)}`).join("\n");
}

function formatStarterGroup(players, group) {
  const grouped = players
    .filter((player) => positionGroup(player.positionAbbreviation) === group)
    .sort((a, b) => (
      positionSortValue(a.positionAbbreviation) - positionSortValue(b.positionAbbreviation) ||
      (a.formationX ?? 50) - (b.formationX ?? 50)
    ));
  if (!grouped.length) return "";
  return [
    `**${group}**`,
    ...grouped.map((player) => {
      const position = detailedPositionLabel(player.positionAbbreviation);
      const prefix = position ? `${position} ` : "";
      return `・${prefix}${lineupPlayerName(player, { japanese: true, includeAge: true, includeClub: true })}`;
    }),
  ].join("\n");
}

function formatTextLineup(lineup) {
  const groups = ["GK", "DF", "MF", "FW"]
    .map((group) => formatStarterGroup(lineup.starters, group))
    .filter(Boolean);
  return [
    `## ${teamLabel(lineup.teamName)} ${lineup.formation ? `(${lineup.formation})` : ""}`.trim(),
    ...groups,
  ].join("\n\n");
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
  const [summary, matchPage] = await Promise.all([
    fetchSummary(event.id),
    fetchMatchPage(event.id).catch((err) => {
      console.warn(`ESPN match page formation fetch failed: ${err.message}`);
      return "";
    }),
  ]);
  return { event, lineups: parseOfficialLineups(summary, matchPage ? parseMatchPageFormations(matchPage) : []) };
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

  if (options.textOnly) {
    return {
      content: [
        contentHeader.join("\n"),
        lineups.slice(0, 2).map(formatTextLineup).join("\n\n"),
      ].join("\n\n"),
      allowed_mentions: { parse: [] },
    };
  }

  if (options.attachImage) {
    const image = await buildLineupImage(event.id, undefined, options);
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

export async function buildLineupImagePayload(teamQuery = "", options = {}) {
  const { event, lineups } = await eventWithLineups("", teamQuery);
  if (!event || lineups.length < 2) return null;

  const image = await buildLineupImage(event.id, undefined, options);
  return {
    content: [
      `# ${eventTitle(event)}`,
      `${eventMeta(event)} / 公式スタメン`,
      eventRankLine(event),
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

async function renderLineupData(event, lineups, options = {}) {
  const layouts = await Promise.all(lineups.slice(0, 2).map((lineup) => (
    lineup.formationLayout
      ? { source: "espn-match-page", issue: "", layout: lineup.formationLayout }
      : buildLineupLayout({
          apiKey: options.geminiApiKey,
          teamName: lineup.teamName,
          formation: lineup.formation,
          starters: lineup.starters,
        })
  )));

  return lineups.slice(0, 2).map((lineup, index) => {
    const opponentName = lineups.find((candidate) => candidate.teamName !== lineup.teamName)?.teamName ?? "";
    const layoutResult = layouts[index];
    console.log("Lineup layout selected", {
      teamName: lineup.teamName,
      source: layoutResult.source,
      issue: layoutResult.issue,
    });
    return {
      teamName: lineup.teamName,
      opponentName,
      formation: lineup.formation,
      kickoffLabel: `${hmInTokyo(event.date)} JST`,
      starters: lineup.starters,
      substitutes: lineup.substitutes,
      flagUrl: teamFlagUrl(lineup.teamName),
      flagCode: flagCode(lineup.teamName),
      layout: layoutResult.layout,
    };
  });
}

export async function buildLineupImage(eventId, teamName, options = {}) {
  if (!eventId) {
    throw new Error("event query parameter is required");
  }

  const { event, lineups } = await eventWithLineups(eventId);
  if (!event || lineups.length < 2) {
    throw new Error("official lineups are not available");
  }

  if (!teamName) {
    const renderLineups = await renderLineupData(event, lineups, options);
    const data = await withTimeout(renderLineupPng(buildMatchLineupSvg({
      title: eventTitleEn(event),
      kickoffLabel: imageEventMeta(event),
      lineups: renderLineups,
    }), 1200), 8000, "PNG render timeout");
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
  const layoutResult = lineup.formationLayout
    ? { source: "espn-match-page", issue: "", layout: lineup.formationLayout }
    : await buildLineupLayout({
        apiKey: options.geminiApiKey,
        teamName: lineup.teamName,
        formation: lineup.formation,
        starters: lineup.starters,
      });
  console.log("Lineup layout selected", {
    teamName: lineup.teamName,
    source: layoutResult.source,
    issue: layoutResult.issue,
  });
  const svg = buildLineupSvg({
    teamName: lineup.teamName,
    opponentName,
    formation: lineup.formation,
    kickoffLabel: `${hmInTokyo(event.date)} JST`,
    starters: lineup.starters,
    substitutes: lineup.substitutes,
    flagUrl: teamFlagUrl(lineup.teamName),
    flagCode: flagCode(lineup.teamName),
    layout: layoutResult.layout,
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
