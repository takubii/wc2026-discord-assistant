import { PLAYER_DATA } from "./players.generated.js";

const TEAM_LABELS = {
  Argentina: "アルゼンチン",
  Australia: "オーストラリア",
  Belgium: "ベルギー",
  Brazil: "ブラジル",
  Canada: "カナダ",
  Colombia: "コロンビア",
  Croatia: "クロアチア",
  England: "イングランド",
  France: "フランス",
  Germany: "ドイツ",
  Japan: "日本",
  Mexico: "メキシコ",
  Morocco: "モロッコ",
  Netherlands: "オランダ",
  Portugal: "ポルトガル",
  Scotland: "スコットランド",
  "South Korea": "韓国",
  Spain: "スペイン",
  Switzerland: "スイス",
  "United States": "アメリカ",
  Uruguay: "ウルグアイ",
};
const BROAD_POSITION_LABELS = {
  GK: "GK",
  DF: "DF",
  MF: "MF",
  FW: "FW",
};
const POSITION_ALIASES = {
  ゴールキーパー: "Goalkeeper",
  キーパー: "Goalkeeper",
  センターバック: "Centre-Back",
  左サイドバック: "Left-Back",
  右サイドバック: "Right-Back",
  守備的MF: "Defensive Midfield",
  ボランチ: "Defensive Midfield",
  セントラルMF: "Central Midfield",
  攻撃的MF: "Attacking Midfield",
  トップ下: "Attacking Midfield",
  左MF: "Left Midfield",
  右MF: "Right Midfield",
  左ウイング: "Left Winger",
  右ウイング: "Right Winger",
  ウイング: "Winger",
  セカンドトップ: "Second Striker",
  センターフォワード: "Centre-Forward",
  CF: "Centre-Forward",
};
const BROAD_ORDER = ["GK", "DF", "MF", "FW"];

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamLabel(teamName) {
  return TEAM_LABELS[teamName] ?? teamName;
}

function normalizePositionQuery(value) {
  const trimmed = (value ?? "").trim();
  return POSITION_ALIASES[trimmed] ?? trimmed;
}

function findTeam(teamQuery) {
  const normalized = normalize(teamQuery ?? "");
  if (!normalized) return null;
  return (
    PLAYER_DATA.teams.find((team) => normalize(team.team) === normalized) ??
    PLAYER_DATA.teams.find((team) => normalize(team.team).includes(normalized))
  );
}

function allPlayers() {
  return PLAYER_DATA.teams.flatMap((team) => team.players);
}

function playerPositionLabel(player) {
  return player.mainPosition ?? player.broadPosition;
}

function jaPosition(position) {
  const map = {
    GK: "GK",
    DF: "DF",
    MF: "MF",
    FW: "FW",
    Goalkeeper: "ゴールキーパー",
    "Centre-Back": "センターバック",
    "Left-Back": "左サイドバック",
    "Right-Back": "右サイドバック",
    "Defensive Midfield": "守備的MF",
    "Central Midfield": "セントラルMF",
    "Attacking Midfield": "攻撃的MF",
    "Left Midfield": "左MF",
    "Right Midfield": "右MF",
    "Left Winger": "左ウイング",
    "Right Winger": "右ウイング",
    "Second Striker": "セカンドトップ",
    "Centre-Forward": "センターフォワード",
  };
  return map[position] ?? position;
}

function formatPlayerLine(player) {
  const main = jaPosition(player.mainPosition ?? player.broadPosition);
  const positions = [
    main,
    ...((player.otherPositions ?? []).length ? [`サブ: ${player.otherPositions.map(jaPosition).join(", ")}`] : []),
  ].join(" / ");
  const club = player.club ? `\n> 所属: ${player.club}` : "";
  return `### ${player.name}\n> 得意位置: ${positions}${club}`;
}

function formatCompactPlayerLine(player) {
  const main = jaPosition(player.mainPosition ?? player.broadPosition);
  const other = (player.otherPositions ?? []).length
    ? ` / サブ: ${player.otherPositions.map(jaPosition).join(", ")}`
    : "";
  const club = player.club ? `（${player.club}）` : "";
  return `• **${player.name}** - ${main}${other}${club}`;
}

function splitIntoMessages(header, lines, maxLength = 1850) {
  const messages = [];
  let current = [header, ""];

  for (const line of lines) {
    const next = [...current, line].join("\n\n");
    if (next.length > maxLength && current.length > 2) {
      messages.push(current.join("\n\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) messages.push(current.join("\n\n"));
  return messages.map((content) => ({ content, allowed_mentions: { parse: [] } }));
}

export function buildSquadPayloads(teamQuery, positionQuery = "") {
  const team = findTeam(teamQuery);
  if (!team) {
    return [{
      content: `チームが見つかりませんでした: ${teamQuery}`,
      allowed_mentions: { parse: [] },
    }];
  }

  const position = normalizePositionQuery(positionQuery);
  const normalizedPosition = normalize(position);
  const players = normalizedPosition
    ? team.players.filter((player) =>
        [player.mainPosition, player.broadPosition, player.broadPositionLabel, ...(player.otherPositions ?? [])]
          .filter(Boolean)
          .some((position) => normalize(position).includes(normalizedPosition))
      )
    : team.players;

  const suffix = normalizedPosition ? ` / ${jaPosition(position)}` : "";
  const header = `# ${teamLabel(team.team)} 代表メンバー${suffix}\n全${players.length}名`;
  const grouped = new Map();
  for (const player of players) {
    const group = player.broadPosition ?? "その他";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(player);
  }
  const groupOrder = [...BROAD_ORDER, ...[...grouped.keys()].filter((key) => !BROAD_ORDER.includes(key))];
  const lines = groupOrder
    .filter((group) => grouped.has(group))
    .map((group) => [
      `## ${BROAD_POSITION_LABELS[group] ?? group}`,
      ...grouped.get(group).map(formatCompactPlayerLine),
    ].join("\n"));

  return splitIntoMessages(header, lines.length ? lines : ["該当する選手はいません。"]);
}

export function buildPlayerPayloads(nameQuery) {
  const normalized = normalize(nameQuery ?? "");
  const players = allPlayers()
    .filter((player) => normalize(player.name).includes(normalized))
    .slice(0, 20);

  if (players.length === 0) {
    return [{
      content: `選手が見つかりませんでした: ${nameQuery}`,
      allowed_mentions: { parse: [] },
    }];
  }

  const lines = players.map((player) => {
    const transfermarkt = player.transfermarktUrl ? `\n> ${player.transfermarktUrl}` : "";
    return `## ${player.name}（${teamLabel(player.team)}）\n${formatPlayerLine(player)}${transfermarkt}`;
  });

  return splitIntoMessages("# 選手検索", lines);
}

export function buildPositionsPayloads(teamQuery) {
  const team = findTeam(teamQuery);
  if (!team) {
    return [{
      content: `チームが見つかりませんでした: ${teamQuery}`,
      allowed_mentions: { parse: [] },
    }];
  }

  const grouped = new Map();
  for (const player of team.players) {
    const position = playerPositionLabel(player);
    if (!grouped.has(position)) grouped.set(position, []);
    grouped.get(position).push(player.name);
  }

  const lines = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, names]) => `## ${jaPosition(position)}\n${names.map((name) => `• ${name}`).join("\n")}`);

  return splitIntoMessages(`# ${teamLabel(team.team)} ポジション別`, lines);
}

export function playersMetadata() {
  const playerCount = allPlayers().length;
  const enrichedCount = allPlayers().filter((player) => player.mainPosition).length;
  return { generatedAt: PLAYER_DATA.generatedAt, teamCount: PLAYER_DATA.teams.length, playerCount, enrichedCount };
}
