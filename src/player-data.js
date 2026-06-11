import { PLAYER_DATA } from "./players.generated.js";

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function formatPlayerLine(player) {
  const positions = [
    player.mainPosition ?? player.broadPosition,
    ...((player.otherPositions ?? []).length ? [`other: ${player.otherPositions.join(", ")}`] : []),
  ].join(" / ");
  const club = player.club ? ` - ${player.club}` : "";
  return `• **${player.name}** - ${positions}${club}`;
}

function truncateLines(header, lines, maxLength = 1900) {
  const output = [header, ""];
  for (const line of lines) {
    const next = [...output, line].join("\n");
    if (next.length > maxLength) {
      output.push(`...ほか ${lines.length - (output.length - 2)} 名`);
      break;
    }
    output.push(line);
  }
  return output.join("\n");
}

export function buildSquadPayload(teamQuery, positionQuery = "") {
  const team = findTeam(teamQuery);
  if (!team) {
    return {
      content: `チームが見つかりませんでした: ${teamQuery}`,
      allowed_mentions: { parse: [] },
    };
  }

  const normalizedPosition = normalize(positionQuery);
  const players = normalizedPosition
    ? team.players.filter((player) =>
        [player.mainPosition, player.broadPosition, player.broadPositionLabel, ...(player.otherPositions ?? [])]
          .filter(Boolean)
          .some((position) => normalize(position).includes(normalizedPosition))
      )
    : team.players;

  const suffix = normalizedPosition ? ` / ${positionQuery}` : "";
  const header = `# ${team.team} squad${suffix}\n全${players.length}名`;
  const lines = players.map(formatPlayerLine);

  return {
    content: truncateLines(header, lines.length ? lines : ["該当する選手はいません。"]),
    allowed_mentions: { parse: [] },
  };
}

export function buildPlayerPayload(nameQuery) {
  const normalized = normalize(nameQuery ?? "");
  const players = allPlayers()
    .filter((player) => normalize(player.name).includes(normalized))
    .slice(0, 8);

  if (players.length === 0) {
    return {
      content: `選手が見つかりませんでした: ${nameQuery}`,
      allowed_mentions: { parse: [] },
    };
  }

  const lines = players.map((player) => {
    const transfermarkt = player.transfermarktUrl ? `\n> ${player.transfermarktUrl}` : "";
    return `## ${player.name} (${player.team})\n${formatPlayerLine(player)}${transfermarkt}`;
  });

  return {
    content: truncateLines("# Player search", lines),
    allowed_mentions: { parse: [] },
  };
}

export function buildPositionsPayload(teamQuery) {
  const team = findTeam(teamQuery);
  if (!team) {
    return {
      content: `チームが見つかりませんでした: ${teamQuery}`,
      allowed_mentions: { parse: [] },
    };
  }

  const grouped = new Map();
  for (const player of team.players) {
    const position = playerPositionLabel(player);
    if (!grouped.has(position)) grouped.set(position, []);
    grouped.get(position).push(player.name);
  }

  const lines = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, names]) => `## ${position}\n${names.map((name) => `• ${name}`).join("\n")}`);

  return {
    content: truncateLines(`# ${team.team} positions`, lines),
    allowed_mentions: { parse: [] },
  };
}

export function playersMetadata() {
  const playerCount = allPlayers().length;
  const enrichedCount = allPlayers().filter((player) => player.mainPosition).length;
  return { generatedAt: PLAYER_DATA.generatedAt, teamCount: PLAYER_DATA.teams.length, playerCount, enrichedCount };
}
