import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const ESPN_SQUADS_URL =
  "https://www.espn.com/soccer/story/_/id/48757621/2026-world-cup-squad-lists-players-announced-all-48-teams";
const FIFA_SQUAD_LISTS_URL = "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf";
const TRANSFERMARKT_BASE = "https://www.transfermarkt.com";
const BROAD_POSITIONS = {
  Goalkeepers: "GK",
  Defenders: "DF",
  Midfielders: "MF",
  Forwards: "FW",
};
const FIFA_POSITION_LABELS = {
  GK: "Goalkeepers",
  DF: "Defenders",
  MF: "Midfielders",
  FW: "Forwards",
};
const FIFA_TEAM_ALIASES = {
  "Bosnia And Herzegovina": "Bosnia-Herzegovina",
  "Cabo Verde": "Cape Verde",
  "Côte D'Ivoire": "Ivory Coast",
  "IR Iran": "Iran",
  "Korea Republic": "South Korea",
  USA: "United States",
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
  const transliterated = value
    .replace(/[ıİ]/g, (char) => (char === "ı" ? "i" : "I"))
    .replace(/[øØ]/g, (char) => (char === "ø" ? "o" : "O"))
    .replace(/[đĐ]/g, (char) => (char === "đ" ? "d" : "D"))
    .replace(/[ðÐ]/g, (char) => (char === "ð" ? "d" : "D"))
    .replace(/[łŁ]/g, (char) => (char === "ł" ? "l" : "L"))
    .replace(/[þÞ]/g, (char) => (char === "þ" ? "th" : "Th"))
    .replace(/[ß]/g, "ss")
    .replace(/[æÆ]/g, (char) => (char === "æ" ? "ae" : "AE"))
    .replace(/[œŒ]/g, (char) => (char === "œ" ? "oe" : "OE"));

  return transliterated
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

function parseMarketValueEur(value) {
  const normalized = value.replace(/\s+/g, "").trim();
  const match = normalized.match(/^€([\d.]+)(bn|m|k)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "bn") return Math.round(amount * 1_000_000_000);
  if (suffix === "m") return Math.round(amount * 1_000_000);
  if (suffix === "k") return Math.round(amount * 1_000);
  return Math.round(amount);
}

function parseAge(value) {
  const age = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(age) && age > 0 ? age : null;
}

function parseShirtNumber(value) {
  const shirtNumber = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(shirtNumber) && shirtNumber > 0 ? shirtNumber : null;
}

function parseDateOfBirth(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function ageFromDateOfBirth(dateOfBirth, at = new Date()) {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) return null;
  let age = at.getUTCFullYear() - year;
  const monthDiff = at.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < day)) age -= 1;
  return age > 0 ? age : null;
}

function titleCaseWord(word) {
  return word
    .split("-")
    .map((part) => {
      if (!part) return part;
      const lower = part.toLocaleLowerCase("en-US");
      return `${lower[0].toLocaleUpperCase("en-US")}${lower.slice(1)}`;
    })
    .join("-");
}

function displayNameFromFifaName(playerName) {
  const tokens = playerName.split(/\s+/).filter(Boolean);
  const firstGivenNameIndex = tokens.findIndex((token) => /[a-z]/.test(token));
  const orderedTokens = firstGivenNameIndex > 0
    ? [...tokens.slice(firstGivenNameIndex), ...tokens.slice(0, firstGivenNameIndex)]
    : tokens;
  return orderedTokens.map(titleCaseWord).join(" ");
}

function parseFifaClub(value) {
  const match = value.match(/^(.*?)\s*\(([A-Z]{3})\)$/);
  return {
    club: (match?.[1] ?? value).trim(),
    clubCountryCode: match?.[2] ?? null,
  };
}

function nameTokenKey(name) {
  return normalize(name).split(" ").filter(Boolean).sort().join(" ");
}

function nameTokens(name) {
  return normalize(name).split(" ").filter(Boolean);
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function tokenSimilarity(a, b) {
  if (a === b) return 1;
  const tokenAliases = {
    andy: "andrew",
    dom: "dominic",
  };
  if (tokenAliases[a] === b || tokenAliases[b] === a) return 0.94;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.9;

  const distance = editDistance(a, b);
  const longest = Math.max(a.length, b.length);
  if (longest >= 5 && distance <= 1) return 0.86;
  if (longest >= 6 && distance <= 2) return 0.78;
  if (longest >= 3 && distance <= 1) return 0.72;
  return 0;
}

function tokenCoverage(sourceTokens, targetTokens) {
  if (sourceTokens.length === 0 || targetTokens.length === 0) return 0;
  const total = sourceTokens.reduce((sum, token) => {
    const best = Math.max(...targetTokens.map((candidate) => tokenSimilarity(token, candidate)));
    return sum + best;
  }, 0);
  return total / sourceTokens.length;
}

function clubSimilarity(a, b) {
  const normalizedA = normalize(a ?? "");
  const normalizedB = normalize(b ?? "");
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return 0.75;
  return tokenCoverage(normalizedA.split(" "), normalizedB.split(" "));
}

function fuzzyNameScore(espnPlayer, transfermarktPlayer) {
  const sourceTokens = nameTokens(espnPlayer.name);
  const targetTokens = nameTokens(transfermarktPlayer.name);
  const sourceCoverage = tokenCoverage(sourceTokens, targetTokens);
  const targetCoverage = tokenCoverage(targetTokens, sourceTokens);
  const clubScore = clubSimilarity(espnPlayer.club, transfermarktPlayer.club);

  if (sourceCoverage >= 0.98 && targetCoverage >= 0.65) return 100 + clubScore;
  if (sourceCoverage >= 0.82 && targetCoverage >= 0.72) return 90 + clubScore;
  if (sourceCoverage >= 0.45 && targetCoverage >= 0.95 && clubScore >= 0.72) return 84 + clubScore;
  if (sourceCoverage >= 0.72 && clubScore >= 0.72) return 82 + clubScore;
  if (sourceCoverage >= 0.58 && targetCoverage >= 0.58 && clubScore >= 0.72) return 76 + clubScore;
  return 0;
}

function findTransfermarktPlayer(tmPlayers, player) {
  const exact = tmPlayers.get(normalize(player.name));
  if (exact) return exact;

  const tmPlayersByTokens = new Map([...tmPlayers.values()].map((tmPlayer) => [nameTokenKey(tmPlayer.name), tmPlayer]));
  const tokenMatch = tmPlayersByTokens.get(nameTokenKey(player.name));
  if (tokenMatch) return tokenMatch;

  const candidates = [...tmPlayers.values()]
    .map((tmPlayer) => ({ tmPlayer, score: fuzzyNameScore(player, tmPlayer) }))
    .filter((candidate) => candidate.score >= 76)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.tmPlayer ?? null;
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
      clubUrl: null,
      broadPosition,
      broadPositionLabel,
      mainPosition: null,
      otherPositions: [],
      marketValue: null,
      marketValueEur: null,
      age: null,
      ageUpdatedAt: null,
      shirtNumber: null,
      transfermarktUrl: null,
      positionSource: null,
      positionUpdatedAt: null,
    }));

    currentTeam.players.push(...players);
  }

  return teams.filter((team) => team.players.length > 0);
}

async function fetchFifaSquads() {
  const parser = new PDFParse({ url: FIFA_SQUAD_LISTS_URL });
  const result = await parser.getText();
  await parser.destroy();

  const pageChunks = result.text.split(/-- \d+ of 48 --/g);
  const teams = [];

  for (const chunk of pageChunks) {
    const header = chunk.match(/(?:^|\n)([^\n]+) \(([A-Z]{3})\)\n# POS\s+\tPLAYER NAME/);
    if (!header) continue;

    const officialTeam = header[1].trim();
    const teamName = FIFA_TEAM_ALIASES[officialTeam] ?? officialTeam;
    const body = chunk.slice(header.index + header[0].length);
    const players = [];

    for (const line of body.split("\n")) {
      const cells = line.split(/\t+/).map((cell) => cell.replace(/\s+/g, " ").trim());
      const firstCell = cells[0] ?? "";
      const playerMatch = firstCell.match(/^(GK|DF|MF|FW)\s+(.+)$/);
      if (!playerMatch || cells.length < 6) continue;

      const broadPosition = playerMatch[1];
      const fifaPlayerName = playerMatch[2].trim();
      const dateOfBirth = parseDateOfBirth(cells[4] ?? "");
      const { club, clubCountryCode } = parseFifaClub(cells[5] ?? "");

      players.push({
        team: teamName,
        name: displayNameFromFifaName(fifaPlayerName),
        club,
        clubCountryCode,
        clubUrl: null,
        broadPosition,
        broadPositionLabel: FIFA_POSITION_LABELS[broadPosition],
        mainPosition: null,
        otherPositions: [],
        marketValue: null,
        marketValueEur: null,
        age: ageFromDateOfBirth(dateOfBirth),
        dateOfBirth,
        ageUpdatedAt: new Date().toISOString(),
        shirtNumber: players.length + 1,
        transfermarktUrl: null,
        positionSource: null,
        positionUpdatedAt: null,
        fifaName: fifaPlayerName,
        nameOnShirt: cells[3] || null,
        caps: Number(cells[7]) || null,
        goals: Number(cells[8]) || null,
      });
    }

    if (players.length > 0) {
      teams.push({ team: teamName, players });
    }
  }

  return teams;
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
  const infoLabels = $(".info-table__content--regular").toArray();
  let age = null;
  for (const label of infoLabels) {
    const text = $(label).text().replace(/\s+/g, " ").trim();
    if (!/^Date of birth\/Age:/i.test(text)) continue;
    age = parseAge($(label).next(".info-table__content--bold").text().replace(/\s+/g, " ").trim());
    break;
  }

  return {
    mainPosition: mainPosition ? cleanDetailedPosition(mainPosition) : null,
    otherPositions: otherPositions.map(cleanDetailedPosition),
    age,
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
    const shirtNumber = parseShirtNumber($(row).children("td").eq(0).text().replace(/\s+/g, " ").trim());
    const position = $(cells[2]).text().replace(/\s+/g, " ").trim();
    const age = parseAge($(row).children("td").eq(2).text().replace(/\s+/g, " ").trim());
    const clubLink = $(row).find('td.zentriert a[title][href*="/startseite/verein/"]').first();
    const club = clubLink.find("img[title]").first().attr("title") ?? clubLink.attr("title") ?? "";
    const clubHref = clubLink.attr("href") ?? "";
    const marketValue = $(row).find("td.rechts.hauptlink a").first().text().replace(/\s+/g, " ").trim();
    if (!name || !href || !position) return;
    if (!players.has(normalize(name))) {
      players.set(normalize(name), {
        name,
        mainPosition: cleanDetailedPosition(position),
        club,
        clubUrl: clubHref ? new URL(clubHref, TRANSFERMARKT_BASE).toString() : null,
        marketValue: marketValue || null,
        marketValueEur: marketValue ? parseMarketValueEur(marketValue) : null,
        age,
        shirtNumber,
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
  let matched = 0;

  for (const player of team.players) {
    const tmPlayer = findTransfermarktPlayer(tmPlayers, player);
    if (!tmPlayer) continue;
    Object.assign(player, {
      mainPosition: tmPlayer.mainPosition,
      otherPositions: player.otherPositions ?? [],
      club: tmPlayer.club || player.club,
      clubUrl: tmPlayer.clubUrl ?? player.clubUrl ?? null,
      marketValue: tmPlayer.marketValue ?? player.marketValue ?? null,
      marketValueEur: tmPlayer.marketValueEur ?? player.marketValueEur ?? null,
      age: tmPlayer.age ?? player.age ?? null,
      ageUpdatedAt: tmPlayer.age ? new Date().toISOString() : player.ageUpdatedAt ?? null,
      shirtNumber: tmPlayer.shirtNumber ?? player.shirtNumber ?? null,
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
          ageUpdatedAt: positions.age ? new Date().toISOString() : player.ageUpdatedAt ?? null,
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
        ageUpdatedAt: positions.age ? new Date().toISOString() : player.ageUpdatedAt ?? null,
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
  let squadSource = FIFA_SQUAD_LISTS_URL;
  let teams = await fetchFifaSquads();
  if (teams.length === 0) {
    console.warn("FIFA squad PDF returned no teams, falling back to ESPN squad article");
    squadSource = ESPN_SQUADS_URL;
    teams = await fetchEspnSquads();
  }

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
    squadSource,
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
