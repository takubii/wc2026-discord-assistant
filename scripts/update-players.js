import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";

const ESPN_SQUADS_URL =
  "https://www.espn.com/soccer/story/_/id/48757621/2026-world-cup-squad-lists-players-announced-all-48-teams";
const TRANSFERMARKT_BASE = "https://www.transfermarkt.com";
const BROAD_POSITIONS = {
  Goalkeepers: "GK",
  Defenders: "DF",
  Midfielders: "MF",
  Forwards: "FW",
};
const ESPN_USER_AGENT = "Mozilla/5.0";
const TRANSFERMARKT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";
const TRANSFERMARKT_PARTICIPANTS_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025";
const TRANSFERMARKT_TEAM_ALIASES = {
  "Congo DR": "Democratic Republic of the Congo",
  Curacao: "Curaçao",
  Türkiye: "Turkiye",
};

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanDetailedPosition(position) {
  return position.replace(/^(Goalkeeper|Defence|Defender|Midfield|Midfielder|Attack|Attacker)\s+-\s+/i, "").trim();
}

function nameTokenKey(name) {
  return normalize(name).split(" ").filter(Boolean).sort().join(" ");
}

async function fetchHtml(url, userAgent = ESPN_USER_AGENT) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function parsePlayersList(text) {
  const entries = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    const looksLikeNextPlayer = /^,\s+[\p{Lu}][^,()]+ \(/u.test(text.slice(i));
    if (char === "," && (depth === 0 || looksLikeNextPlayer)) {
      if (depth > 0) current += ")";
      entries.push(current);
      current = "";
      depth = 0;
      continue;
    }
    current += char;
  }
  entries.push(current);

  return entries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*?)\s*\((.*?)\)\s*$/);
      return {
        name: (match?.[1] ?? entry).trim(),
        club: (match?.[2] ?? "").trim(),
      };
    });
}

async function fetchEspnSquads() {
  const html = await fetchHtml(ESPN_SQUADS_URL);
  const $ = cheerio.load(html);
  const nodes = $("h2,p").toArray();
  const teams = [];
  let currentTeam = null;

  for (const node of nodes) {
    const tag = node.tagName?.toLowerCase();
    const text = $(node).text().replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (tag === "h2") {
      if (/^GROUP [A-L]$/.test(text)) {
        currentTeam = null;
        continue;
      }

      currentTeam = { team: text, players: [] };
      teams.push(currentTeam);
      continue;
    }

    if (!currentTeam) continue;

    const positionMatch = text.match(/^(Goalkeepers|Defenders|Midfielders|Forwards):\s*(.+)$/);
    if (!positionMatch) continue;

    const broadPositionLabel = positionMatch[1];
    const broadPosition = BROAD_POSITIONS[broadPositionLabel];
    const players = parsePlayersList(positionMatch[2]).map((player) => ({
      team: currentTeam.team,
      name: player.name,
      club: player.club,
      broadPosition,
      broadPositionLabel,
      mainPosition: null,
      otherPositions: [],
      transfermarktUrl: null,
      positionSource: null,
      positionUpdatedAt: null,
    }));

    currentTeam.players.push(...players);
  }

  return teams.filter((team) => team.players.length > 0);
}

async function searchTransfermarktPlayer(player) {
  for (const rawQuery of [`${player.name} ${player.club}`.trim(), player.name]) {
    const query = encodeURIComponent(rawQuery);
    const html = await fetchHtml(
      `${TRANSFERMARKT_BASE}/schnellsuche/ergebnis/schnellsuche?query=${query}`,
      TRANSFERMARKT_USER_AGENT
    );
    const $ = cheerio.load(html);
    const candidates = [];

    $('a[href*="/profil/spieler/"]').each((_, anchor) => {
      const name = $(anchor).text().replace(/\s+/g, " ").trim();
      const href = $(anchor).attr("href");
      if (!name || !href) return;
      candidates.push({
        name,
        href,
        score: normalize(name) === normalize(player.name) ? 2 : normalize(name).includes(normalize(player.name)) ? 1 : 0,
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates.find((candidate) => candidate.score > 0) ?? candidates[0];
    if (best) return new URL(best.href, TRANSFERMARKT_BASE).toString();
  }

  return null;
}

async function fetchTransfermarktPositions(url) {
  const html = await fetchHtml(url, TRANSFERMARKT_USER_AGENT);
  const $ = cheerio.load(html);
  let mainPosition = $(".detail-position__inner-box .detail-position__position")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (!mainPosition) {
    const text = $("body").text().replace(/\s+/g, " ").trim();
    mainPosition = text.match(/Facts and data .*? Position:\s*(.*?)\s+Foot:/)?.[1]?.trim() ?? "";
  }
  const otherPositions = $(".detail-position__box > .detail-position__position .detail-position__position")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    mainPosition: mainPosition ? cleanDetailedPosition(mainPosition) : null,
    otherPositions: otherPositions.map(cleanDetailedPosition),
  };
}

async function fetchTransfermarktTeamIds() {
  const html = await fetchHtml(TRANSFERMARKT_PARTICIPANTS_URL, TRANSFERMARKT_USER_AGENT);
  const $ = cheerio.load(html);
  const teams = new Map();

  $('a[href*="/startseite/verein/"]').each((_, anchor) => {
    const name = $(anchor).text().replace(/\s+/g, " ").trim();
    const href = $(anchor).attr("href");
    const id = href?.match(/\/verein\/(\d+)/)?.[1];
    if (name && id && !teams.has(normalize(name))) {
      teams.set(normalize(name), { name, id });
    }
  });

  return teams;
}

function findTransfermarktTeam(teamIds, teamName) {
  const aliased = TRANSFERMARKT_TEAM_ALIASES[teamName] ?? teamName;
  return teamIds.get(normalize(aliased)) ?? teamIds.get(normalize(teamName));
}

async function fetchTransfermarktSquad(teamId) {
  const html = await fetchHtml(`${TRANSFERMARKT_BASE}/-/kader/verein/${teamId}`, TRANSFERMARKT_USER_AGENT);
  const $ = cheerio.load(html);
  const players = new Map();

  $("table.items tbody tr").each((_, row) => {
    const link = $(row).find('td.hauptlink a[href*="/profil/spieler/"]').first();
    const name = link.text().replace(/\s+/g, " ").trim();
    const href = link.attr("href");
    const cells = $(row).find("table.inline-table td").toArray();
    const position = $(cells[2]).text().replace(/\s+/g, " ").trim();
    const club = $(row).find('td.zentriert a[title] img[title], td.zentriert a[title]').first().attr("title") ?? "";
    if (!name || !href || !position) return;
    if (!players.has(normalize(name))) {
      players.set(normalize(name), {
        name,
        mainPosition: cleanDetailedPosition(position),
        club,
        transfermarktUrl: new URL(href, TRANSFERMARKT_BASE).toString(),
      });
    }
  });

  return players;
}

async function enrichTeamFromTransfermarktSquad(team, teamIds) {
  const tmTeam = findTransfermarktTeam(teamIds, team.team);
  if (!tmTeam) {
    console.warn(`${team.team}: Transfermarkt team not found`);
    return;
  }

  const tmPlayers = await fetchTransfermarktSquad(tmTeam.id);
  const tmPlayersByTokens = new Map([...tmPlayers.values()].map((player) => [nameTokenKey(player.name), player]));
  let matched = 0;

  for (const player of team.players) {
    const tmPlayer = tmPlayers.get(normalize(player.name)) ?? tmPlayersByTokens.get(nameTokenKey(player.name));
    if (!tmPlayer) continue;
    Object.assign(player, {
      mainPosition: tmPlayer.mainPosition,
      otherPositions: player.otherPositions ?? [],
      transfermarktUrl: tmPlayer.transfermarktUrl,
      positionSource: "transfermarkt-team-squad",
      positionUpdatedAt: new Date().toISOString(),
    });
    matched += 1;
  }

  console.log(`${team.team}: enriched ${matched}/${team.players.length}`);
}

async function enrichUnmatchedPlayersWithSearch(teams) {
  for (const team of teams) {
    for (const player of team.players) {
      if (player.mainPosition) continue;
      try {
        const url = await searchTransfermarktPlayer(player);
        if (!url) continue;
        await sleep(700);
        const positions = await fetchTransfermarktPositions(url);
        Object.assign(player, {
          ...positions,
          transfermarktUrl: url,
          positionSource: "transfermarkt-player-search",
          positionUpdatedAt: new Date().toISOString(),
        });
        console.log(`${player.team}: ${player.name} -> ${player.mainPosition ?? "unknown"} (fallback)`);
        await sleep(700);
      } catch (err) {
        console.warn(`${player.team}: ${player.name}: ${err.message}`);
      }
    }
  }
}

async function enrichTeam(teams, teamName) {
  const team = teams.find((candidate) => normalize(candidate.team) === normalize(teamName));
  if (!team) throw new Error(`Team not found: ${teamName}`);

  for (const player of team.players) {
    try {
      const url = await searchTransfermarktPlayer(player);
      if (!url) continue;
      await sleep(700);
      const positions = await fetchTransfermarktPositions(url);
      Object.assign(player, {
        ...positions,
        transfermarktUrl: url,
        positionSource: "transfermarkt",
        positionUpdatedAt: new Date().toISOString(),
      });
      console.log(`${player.team}: ${player.name} -> ${player.mainPosition ?? "unknown"}`);
      await sleep(700);
    } catch (err) {
      console.warn(`${player.team}: ${player.name}: ${err.message}`);
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const enrichTeams = [];
  let enrichAll = false;
  let fallbackSearch = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--enrich-team") {
      enrichTeams.push(args[i + 1]);
      i += 1;
    } else if (args[i] === "--enrich-all") {
      enrichAll = true;
    } else if (args[i] === "--fallback-search") {
      fallbackSearch = true;
    }
  }
  return { enrichAll, fallbackSearch, enrichTeams: enrichTeams.filter(Boolean) };
}

async function main() {
  const { enrichAll, fallbackSearch, enrichTeams } = parseArgs();
  const teams = await fetchEspnSquads();

  if (enrichAll) {
    const tmTeamIds = await fetchTransfermarktTeamIds();
    for (const team of teams) {
      await enrichTeamFromTransfermarktSquad(team, tmTeamIds);
      await sleep(800);
    }
  }

  for (const team of enrichTeams) {
    await enrichTeam(teams, team);
  }

  if (fallbackSearch) {
    await enrichUnmatchedPlayersWithSearch(teams);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    squadSource: ESPN_SQUADS_URL,
    positionSource: "transfermarkt",
    teams,
  };

  await mkdir("data", { recursive: true });
  await mkdir("src", { recursive: true });
  await writeFile("data/players.json", `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(
    "src/players.generated.js",
    `export const PLAYER_DATA = ${JSON.stringify(data, null, 2)};\n`
  );

  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);
  console.log(`Wrote ${teams.length} teams and ${totalPlayers} players.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
