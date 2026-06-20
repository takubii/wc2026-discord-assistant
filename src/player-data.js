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
const POSITION_CHOICES = [
  { name: "GK / ゴールキーパー", value: "Goalkeeper" },
  { name: "DF / ディフェンダー全体", value: "DF" },
  { name: "CB / センターバック", value: "Centre-Back" },
  { name: "LB / 左サイドバック", value: "Left-Back" },
  { name: "RB / 右サイドバック", value: "Right-Back" },
  { name: "MF / ミッドフィルダー全体", value: "MF" },
  { name: "DM / 守備的MF", value: "Defensive Midfield" },
  { name: "CM / セントラルMF", value: "Central Midfield" },
  { name: "AM / 攻撃的MF", value: "Attacking Midfield" },
  { name: "LM / 左MF", value: "Left Midfield" },
  { name: "RM / 右MF", value: "Right Midfield" },
  { name: "FW / フォワード全体", value: "FW" },
  { name: "LW / 左ウイング", value: "Left Winger" },
  { name: "RW / 右ウイング", value: "Right Winger" },
  { name: "SS / セカンドトップ", value: "Second Striker" },
  { name: "CF / センターフォワード", value: "Centre-Forward" },
];
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
  "Arsenal FC": "イングランド",
  "AS Monaco": "モナコ",
  "AS Roma": "イタリア",
  Atalanta: "イタリア",
  "Athletic Club": "スペイン",
  "Atlético Madrid": "スペイン",
  "Atlético de Madrid": "スペイン",
  "Auckland FC": "ニュージーランド",
  "Aston Villa": "イングランド",
  Augsburg: "ドイツ",
  "AFC Bournemouth": "イングランド",
  Barcelona: "スペイン",
  "Bayer Leverkusen": "ドイツ",
  "Bayern Munich": "ドイツ",
  Benfica: "ポルトガル",
  Bologna: "イタリア",
  Bournemouth: "イングランド",
  Braga: "ポルトガル",
  Brentford: "イングランド",
  "Brentford FC": "イングランド",
  Brighton: "イングランド",
  Burnley: "イングランド",
  Celtic: "スコットランド",
  "Celtic FC": "スコットランド",
  Chelsea: "イングランド",
  "Chelsea FC": "イングランド",
  Chivas: "メキシコ",
  "Chicago Fire": "アメリカ",
  "Club Brugge": "ベルギー",
  Como: "イタリア",
  "Como 1907": "イタリア",
  Copenhagen: "デンマーク",
  "Crystal Palace": "イングランド",
  "Borussia Dortmund": "ドイツ",
  "Borussia Mönchengladbach": "ドイツ",
  "Eintracht Frankfurt": "ドイツ",
  Esteghlal: "イラン",
  Everton: "イングランド",
  "Everton FC": "イングランド",
  Fenerbahce: "トルコ",
  Feyenoord: "オランダ",
  "Feyenoord Rotterdam": "オランダ",
  "FC Tokyo": "日本",
  "FC Barcelona": "スペイン",
  Flamengo: "ブラジル",
  Freiburg: "ドイツ",
  Fulham: "イングランド",
  Galatasaray: "トルコ",
  Genk: "ベルギー",
  "Hannover 96": "ドイツ",
  "Hamburger SV": "ドイツ",
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
  "LOSC Lille": "フランス",
  Liverpool: "イングランド",
  "Liverpool FC": "イングランド",
  Lorient: "フランス",
  Lyon: "フランス",
  Mainz: "ドイツ",
  "1.FSV Mainz 05": "ドイツ",
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
  "Parma Calcio 1913": "イタリア",
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
  "SC Freiburg": "ドイツ",
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
const CLUB_COUNTRY_BY_CODE = {
  ARG: "アルゼンチン",
  AUS: "オーストラリア",
  AUT: "オーストリア",
  BEL: "ベルギー",
  BIH: "ボスニア・ヘルツェゴビナ",
  BRA: "ブラジル",
  CAN: "カナダ",
  CIV: "コートジボワール",
  COL: "コロンビア",
  CRO: "クロアチア",
  CUW: "キュラソー",
  CZE: "チェコ",
  DEN: "デンマーク",
  ECU: "エクアドル",
  EGY: "エジプト",
  ENG: "イングランド",
  ESP: "スペイン",
  FRA: "フランス",
  GER: "ドイツ",
  GRE: "ギリシャ",
  HUN: "ハンガリー",
  IRN: "イラン",
  IRQ: "イラク",
  ISR: "イスラエル",
  ITA: "イタリア",
  JPN: "日本",
  KOR: "韓国",
  KSA: "サウジアラビア",
  MAR: "モロッコ",
  MEX: "メキシコ",
  NED: "オランダ",
  NOR: "ノルウェー",
  NZL: "ニュージーランド",
  POR: "ポルトガル",
  QAT: "カタール",
  SCO: "スコットランド",
  SRB: "セルビア",
  SUI: "スイス",
  TUR: "トルコ",
  UAE: "UAE",
  URU: "ウルグアイ",
  USA: "アメリカ",
};

function normalize(value) {
  return normalizeText(value);
}

function normalizePositionQuery(value) {
  const trimmed = (value ?? "").trim();
  return POSITION_ALIASES[trimmed] ?? trimmed;
}

export function positionChoices(query = "") {
  const normalized = normalize(query);
  return POSITION_CHOICES
    .filter((choice) => {
      if (!normalized) return true;
      return normalize(choice.name).includes(normalized) || normalize(choice.value).includes(normalized);
    })
    .slice(0, 25);
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

function nameTokenKey(name) {
  return normalize(name).split(" ").filter(Boolean).sort().join(" ");
}

function compactNameKey(name) {
  return normalize(name).replace(/\s+/g, "");
}

function nameTokens(name) {
  return normalize(name).split(" ").filter(Boolean);
}

function hasNameTokenCoverage(candidateName, queryName) {
  const candidateTokens = new Set(nameTokens(candidateName));
  const queryTokens = nameTokens(queryName);
  const shorter = queryTokens.length <= candidateTokens.size ? queryTokens : [...candidateTokens];
  const longer = queryTokens.length <= candidateTokens.size ? candidateTokens : new Set(queryTokens);

  if (shorter.length < 2) return false;
  return shorter.every((token) => longer.has(token));
}

function hasCompactTokenCoverage(candidateName, queryName) {
  const candidateTokens = nameTokens(candidateName);
  const queryTokens = nameTokens(queryName);
  const candidateCompact = compactNameKey(candidateName);
  const queryCompact = compactNameKey(queryName);

  if (candidateTokens.length < 2 || queryTokens.length < 2) return false;
  return (
    candidateTokens.every((token) => queryCompact.includes(token)) &&
    queryTokens.every((token) => candidateCompact.includes(token))
  );
}

function playerPositionLabel(player) {
  return player.mainPosition ?? player.broadPosition;
}

function positionLabel(position) {
  const map = {
    GK: "GK",
    DF: "DF",
    MF: "MF",
    FW: "FW",
    Defender: "DF",
    Goalkeeper: "GK",
    "Centre-Back": "CB",
    "Left-Back": "LB",
    "Right-Back": "RB",
    "Defensive Midfield": "DM",
    "Central Midfield": "CM",
    "Attacking Midfield": "AM",
    "Left Midfield": "LM",
    "Right Midfield": "RM",
    "Left Winger": "LW",
    "Right Winger": "RW",
    "Second Striker": "SS",
    "Centre-Forward": "CF",
  };
  return map[position] ?? position;
}

export function formatClub(player) {
  if (!player.club) return "";
  if (player.clubCountryCode) return `${player.club} (${player.clubCountryCode})`;
  const country = CLUB_COUNTRY_BY_CLUB[player.club] ?? CLUB_COUNTRY_BY_CODE[player.clubCountryCode];
  return country ? `${player.club} / ${country}` : player.club;
}

function formatMarketValue(player) {
  const value = player.marketValueEur;
  if (!Number.isFinite(value) || value <= 0) return player.marketValue ?? "不明";
  const compact = (amount) => {
    const rounded = Math.round(amount * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };
  if (value >= 1_000_000_000) return `€${compact(value / 1_000_000_000)}bn`;
  if (value >= 1_000_000) return `€${compact(value / 1_000_000)}m`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

export function formatAge(player) {
  return Number.isFinite(player.age) ? `${player.age}歳` : "";
}

export function formatShirtNumber(player) {
  return Number.isFinite(player.shirtNumber) ? `#${player.shirtNumber} ` : "";
}

function formatShirtNumberTag(player) {
  return Number.isFinite(player.shirtNumber) ? `\`#${player.shirtNumber}\` ` : "";
}

export function playerDisplayName(player) {
  return `${formatShirtNumber(player)}${player.name}`;
}

export function playerDisplayMeta(player) {
  return [formatAge(player)].filter(Boolean).join(" / ");
}

export function findPlayerMetadata(teamQuery, playerName) {
  const team = findTeam(teamQuery);
  if (!team) return null;

  const normalizedName = normalize(playerName);
  const tokenKey = nameTokenKey(playerName);
  const compactKey = compactNameKey(playerName);
  return (
    team.players.find((player) => normalize(player.name) === normalizedName) ??
    team.players.find((player) => normalize(player.fifaName) === normalizedName) ??
    team.players.find((player) => nameTokenKey(player.name) === tokenKey) ??
    team.players.find((player) => nameTokenKey(player.fifaName) === tokenKey) ??
    team.players.find((player) => compactNameKey(player.name) === compactKey) ??
    team.players.find((player) => compactNameKey(player.fifaName) === compactKey) ??
    team.players.find((player) => hasNameTokenCoverage(player.name, playerName)) ??
    team.players.find((player) => hasNameTokenCoverage(player.fifaName, playerName)) ??
    team.players.find((player) => hasCompactTokenCoverage(player.name, playerName)) ??
    team.players.find((player) => hasCompactTokenCoverage(player.fifaName, playerName)) ??
    team.players.find((player) => normalize(player.name).includes(normalizedName) || normalizedName.includes(normalize(player.name))) ??
    team.players.find((player) => normalize(player.fifaName).includes(normalizedName) || normalizedName.includes(normalize(player.fifaName))) ??
    null
  );
}

function formatPlayerLine(player) {
  const main = positionLabel(player.mainPosition ?? player.broadPosition);
  const positions = [
    main,
    ...((player.otherPositions ?? []).length ? [`Sub: ${player.otherPositions.map(positionLabel).join(", ")}`] : []),
  ].join(" / ");
  const age = formatAge(player) ? `\n> 年齢: ${formatAge(player)}` : "";
  const club = player.club ? `\n> 所属: ${formatClub(player)}` : "";
  const marketValue = `\n> 市場価値: ${formatMarketValue(player)}`;
  return `### ${playerDisplayName(player)}\n> 得意位置: ${positions}${age}${club}${marketValue}`;
}

function formatCompactPlayerLine(player) {
  const main = positionLabel(player.mainPosition ?? player.broadPosition);
  const other = (player.otherPositions ?? []).length
    ? ` / Sub: ${player.otherPositions.map(positionLabel).join(", ")}`
    : "";
  const age = formatAge(player) ? `  ${formatAge(player)}` : "";
  const details = [
    `${main}${other}`,
    player.club ? formatClub(player) : "",
    formatMarketValue(player),
  ].filter(Boolean);
  return `${formatShirtNumberTag(player)}**${player.name}**${age}\n> ${details.join(" | ")}`;
}

function splitIntoMessages(header, lines, maxLength = 1990, separator = "\n\n") {
  const messages = [];
  let current = header ? [header] : [];

  for (const line of lines) {
    const next = [...current, line].join(separator);
    if (next.length > maxLength && current.length > 1) {
      messages.push(current.join(separator));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) messages.push(current.join(separator));
  return messages.map((content) => ({ content, allowed_mentions: { parse: [] } }));
}

export function buildTeamPayloads(teamQuery, positionQuery = "") {
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

  const suffix = normalizedPosition ? ` / ${positionLabel(position)}` : "";
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
    return `## ${playerDisplayName(player)}（${teamLabel(player.team)}）\n${formatPlayerLine(player)}${transfermarkt}`;
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
    grouped.get(position).push(player);
  }

  const lines = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, players]) => {
      const names = players.map((player) => {
        const age = formatAge(player) ? ` / ${formatAge(player)}` : "";
        return `• ${playerDisplayName(player)}${age}`;
      });
      return `## ${positionLabel(position)}\n${names.join("\n")}`;
    });

  return splitIntoMessages(`# ${teamLabel(team.team)} ポジション別`, lines);
}

export function buildNotablePayloads({ teamQuery = "", positionQuery = "", limit = 20 } = {}) {
  const team = teamQuery ? findTeam(teamQuery) : null;
  if (teamQuery && !team) {
    return [{
      content: `チームが見つかりませんでした: ${teamQuery}`,
      allowed_mentions: { parse: [] },
    }];
  }

  const position = normalizePositionQuery(positionQuery);
  const normalizedPosition = normalize(position);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 5), 50);
  const players = (team ? team.players : allPlayers())
    .filter((player) => Number.isFinite(player.marketValueEur) && player.marketValueEur > 0)
    .filter((player) => {
      if (!normalizedPosition) return true;
      return [player.mainPosition, player.broadPosition, player.broadPositionLabel, ...(player.otherPositions ?? [])]
        .filter(Boolean)
        .some((candidate) => normalize(candidate).includes(normalizedPosition));
    })
    .sort((a, b) => b.marketValueEur - a.marketValueEur)
    .slice(0, parsedLimit);

  const scope = team ? teamLabel(team.team) : "全出場国";
  const suffix = normalizedPosition ? ` / ${positionLabel(position)}` : "";
  const header = `# 注目選手ランキング\n市場価値ベース / ${scope}${suffix}\n上位${players.length}名`;
  const lines = players.length
    ? players.map((player, index) => {
        const rank = index + 1;
        const position = positionLabel(player.mainPosition ?? player.broadPosition);
        const details = [
          formatMarketValue(player),
          formatAge(player),
          position,
          player.club ? formatClub(player) : "",
        ].filter(Boolean);
        return `\`${rank}\` ${formatShirtNumberTag(player)}**${player.name}**（${teamLabel(player.team)}）\n> ${details.join(" | ")}`;
      })
    : ["市場価値が入っている選手が見つかりませんでした。"];

  return splitIntoMessages(`${header}\n`, lines, 1990, "\n");
}

export function playersMetadata() {
  const playerCount = allPlayers().length;
  const enrichedCount = allPlayers().filter((player) => player.mainPosition).length;
  const valuedCount = allPlayers().filter((player) => Number.isFinite(player.marketValueEur) && player.marketValueEur > 0).length;
  const agedCount = allPlayers().filter((player) => Number.isFinite(player.age)).length;
  const numberedCount = allPlayers().filter((player) => Number.isFinite(player.shirtNumber)).length;
  return { generatedAt: PLAYER_DATA.generatedAt, teamCount: PLAYER_DATA.teams.length, playerCount, enrichedCount, valuedCount, agedCount, numberedCount };
}
