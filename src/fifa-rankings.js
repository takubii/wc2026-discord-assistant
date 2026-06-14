import { GROUPS, canonicalTeamName, teamLabel } from "./team-data.js";

export const FIFA_RANKING_UPDATED_AT = "2026-06-11";

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

export function fifaRanking(teamName) {
  return FIFA_RANKINGS[canonicalTeamName(teamName)] ?? null;
}

export function fifaRankSuffix(teamName) {
  const ranking = fifaRanking(teamName);
  return ranking ? `（FIFA ${ranking.rank}位）` : "";
}

export function fifaRankText(teamName) {
  const ranking = fifaRanking(teamName);
  return ranking ? `${teamLabel(canonicalTeamName(teamName))} ${ranking.rank}位` : `${teamLabel(teamName)} 不明`;
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

function rankingLine(team) {
  const ranking = fifaRanking(team);
  if (!ranking) return `- **${teamLabel(team)}** / ${team}: 不明`;
  return `\`${ranking.rank}\` **${teamLabel(team)}** / ${team}  ${ranking.points.toFixed(2)}pt`;
}

export function buildFifaRankingsPayloads(group = "") {
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
    `${normalizedGroup ? `Group ${normalizedGroup}` : "出場48チーム"} / ${FIFA_RANKING_UPDATED_AT}時点`,
    "",
  ].join("\n");

  return splitIntoMessages(header, sortedTeams.map(rankingLine));
}
