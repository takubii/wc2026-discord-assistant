import { PLAYER_DATA } from "./players.generated.js";
import { canonicalTeamName, normalizeText, teamLabel } from "./team-data.js";
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
const CLUB_COUNTRY_BY_CLUB = {
  "AC Milan": "イタリア",
  Ajax: "オランダ",
  "Al Ahly": "エジプト",
  "Al Ain": "UAE",
  "Al Arabi": "カタール",
  "Al Duhail": "カタール",
  "Al Gharafa": "カタール",
  "Al Hilal": "サウジアラビア",
  "Al Ittihad": "サウジアラビア",
  "Al Nassr": "サウジアラビア",
  "Al Qadsiah": "サウジアラビア",
  "Al Rayyan": "カタール",
  "Al Sadd": "カタール",
  "Al Wakrah": "カタール",
  "Al-Zawraa": "イラク",
  "Al-Shorta": "イラク",
  América: "メキシコ",
  Arsenal: "イングランド",
  "AS Monaco": "モナコ",
  "AS Roma": "イタリア",
  Atalanta: "イタリア",
  "Athletic Club": "スペイン",
  "Atlético Madrid": "スペイン",
  "Auckland FC": "ニュージーランド",
  "Aston Villa": "イングランド",
  Augsburg: "ドイツ",
  Barcelona: "スペイン",
  "Bayer Leverkusen": "ドイツ",
  "Bayern Munich": "ドイツ",
  Benfica: "ポルトガル",
  Bologna: "イタリア",
  Bournemouth: "イングランド",
  Braga: "ポルトガル",
  Brentford: "イングランド",
  Brighton: "イングランド",
  Burnley: "イングランド",
  Celtic: "スコットランド",
  Chelsea: "イングランド",
  Chivas: "メキシコ",
  "Chicago Fire": "アメリカ",
  "Club Brugge": "ベルギー",
  Como: "イタリア",
  Copenhagen: "デンマーク",
  "Crystal Palace": "イングランド",
  "Borussia Dortmund": "ドイツ",
  "Borussia Mönchengladbach": "ドイツ",
  "Eintracht Frankfurt": "ドイツ",
  Esteghlal: "イラン",
  Everton: "イングランド",
  Fenerbahce: "トルコ",
  Feyenoord: "オランダ",
  "FC Tokyo": "日本",
  Flamengo: "ブラジル",
  Freiburg: "ドイツ",
  Fulham: "イングランド",
  Galatasaray: "トルコ",
  Genk: "ベルギー",
  "Hannover 96": "ドイツ",
  "Hull City": "イングランド",
  "Inter Miami": "アメリカ",
  "Inter Milan": "イタリア",
  "Istanbul Basaksehir": "トルコ",
  Juventus: "イタリア",
  Kashima: "日本",
  "Kashima Antlers": "日本",
  LAFC: "アメリカ",
  Leeds: "イングランド",
  "Leeds United": "イングランド",
  Lens: "フランス",
  "Le Havre": "フランス",
  Lille: "フランス",
  Liverpool: "イングランド",
  Lorient: "フランス",
  Lyon: "フランス",
  Mainz: "ドイツ",
  "Manchester City": "イングランド",
  "Manchester United": "イングランド",
  Marseille: "フランス",
  Midtjylland: "デンマーク",
  Napoli: "イタリア",
  "NEC Nijmegen": "オランダ",
  Newcastle: "イングランド",
  "Newcastle United": "イングランド",
  Nice: "フランス",
  "New York City FC": "アメリカ",
  "Nottingham Forest": "イングランド",
  "Orlando City": "アメリカ",
  "Orlando Pirates": "南アフリカ",
  Pafos: "キプロス",
  Pakhtakor: "ウズベキスタン",
  Palmeiras: "ブラジル",
  Parma: "イタリア",
  "Paris Saint-Germain": "フランス",
  Persepolis: "イラン",
  PSG: "フランス",
  "PSV Eindhoven": "オランダ",
  Pyramids: "エジプト",
  Rangers: "スコットランド",
  "RB Leipzig": "ドイツ",
  "Real Betis": "スペイン",
  "Real Madrid": "スペイン",
  "Real Sociedad": "スペイン",
  Rennes: "フランス",
  Reims: "フランス",
  "River Plate": "アルゼンチン",
  Rijeka: "クロアチア",
  "Sanfrecce Hiroshima": "日本",
  Sassuolo: "イタリア",
  Sevilla: "スペイン",
  "Slavia Prague": "チェコ",
  "Sporting CP": "ポルトガル",
  "Sparta Prague": "チェコ",
  Strasbourg: "フランス",
  Stuttgart: "ドイツ",
  "Sint-Truiden": "ベルギー",
  Sunderland: "イングランド",
  Swansea: "ウェールズ",
  "Swansea City": "ウェールズ",
  Torino: "イタリア",
  Toronto: "カナダ",
  "Toronto FC": "カナダ",
  "Tottenham Hotspur": "イングランド",
  Tractor: "イラン",
  "TSG Hoffenheim": "ドイツ",
  "Vancouver Whitecaps": "カナダ",
  "Viktoria Plzen": "チェコ",
  Villarreal: "スペイン",
  "VfL Wolfsburg": "ドイツ",
  "Werder Bremen": "ドイツ",
  "Wolverhampton Wanderers": "イングランド",
  "Young Boys": "スイス",
  Zamalek: "エジプト",
};

function normalize(value) {
  return normalizeText(value);
}

function normalizePositionQuery(value) {
  const trimmed = (value ?? "").trim();
  return POSITION_ALIASES[trimmed] ?? trimmed;
}

function findTeam(teamQuery) {
  const canonical = canonicalTeamName(teamQuery ?? "");
  const normalized = normalize(canonical || teamQuery || "");
  if (!normalized) return null;
  return (
    PLAYER_DATA.teams.find((team) => normalize(team.team) === normalize(canonical)) ??
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
    GK: "ゴールキーパー",
    DF: "ディフェンダー",
    MF: "ミッドフィールダー",
    FW: "フォワード",
    Defender: "ディフェンダー",
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

function formatClub(player) {
  if (!player.club) return "";
  const country = CLUB_COUNTRY_BY_CLUB[player.club];
  return country ? `${player.club} / ${country}` : player.club;
}

function formatPlayerLine(player) {
  const main = jaPosition(player.mainPosition ?? player.broadPosition);
  const positions = [
    main,
    ...((player.otherPositions ?? []).length ? [`サブ: ${player.otherPositions.map(jaPosition).join(", ")}`] : []),
  ].join(" / ");
  const club = player.club ? `\n> 所属: ${formatClub(player)}` : "";
  return `### ${player.name}\n> 得意位置: ${positions}${club}`;
}

function formatCompactPlayerLine(player) {
  const main = jaPosition(player.mainPosition ?? player.broadPosition);
  const other = (player.otherPositions ?? []).length
    ? ` / サブ: ${player.otherPositions.map(jaPosition).join(", ")}`
    : "";
  const club = player.club ? `（${formatClub(player)}）` : "";
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
