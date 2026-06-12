function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0][0]}. ${parts.at(-1)}`;
}

function card({ x, y, pos, name, width = 184 }) {
  const safeName = shortName(name);
  const fontSize = safeName.length > 16 ? 16 : safeName.length > 13 ? 18 : 20;
  return `
  <g transform="translate(${x} ${y})">
    <rect x="${-width / 2}" y="-34" width="${width}" height="68" rx="18" class="card"/>
    <text x="0" y="-8" text-anchor="middle" class="pos">${escapeXml(pos)}</text>
    <text x="0" y="21" text-anchor="middle" class="name" style="font-size:${fontSize}px">${escapeXml(safeName)}</text>
  </g>`;
}

function benchLines(substitutes) {
  const names = substitutes.map((player) => shortName(player.name)).slice(0, 12);
  if (!names.length) return ["Not available"];

  const lines = [];
  let current = "";
  for (const name of names) {
    const next = current ? `${current}, ${name}` : name;
    if (next.length > 74 && current) {
      lines.push(current);
      current = name;
    } else {
      current = next;
    }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 3) lines.push(current);

  const remaining = substitutes.length - names.length;
  if (remaining > 0) {
    lines[lines.length - 1] = `${lines.at(-1)} +${remaining} more`;
  }
  return lines;
}

function benchText(substitutes, x = 112, y = 1058) {
  return benchLines(substitutes)
    .map((line, index) => `<text x="${x}" y="${y + index * 22}" class="bench">${escapeXml(line)}</text>`)
    .join("");
}

const XS_BY_COUNT = {
  1: [450],
  2: [330, 570],
  3: [240, 450, 660],
  4: [146, 350, 550, 754],
  5: [124, 300, 450, 600, 776],
};

const ROW_YS_BY_COUNT = {
  1: [520],
  2: [720, 330],
  3: [750, 560, 300],
  4: [750, 620, 430, 270],
  5: [780, 660, 540, 405, 270],
};

function displayPosition(position) {
  const labels = {
    G: "GK",
    CD: "CB",
    "CD-L": "CB",
    "CD-R": "CB",
    "CB-L": "CB",
    "CB-R": "CB",
    F: "CF",
    LF: "LW",
    RF: "RW",
  };
  return labels[position] ?? position ?? "";
}

function parseFormation(formation, outfieldCount) {
  const rows = String(formation ?? "")
    .match(/\d+/g)
    ?.map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 5);
  return rows?.reduce((sum, value) => sum + value, 0) === outfieldCount ? rows : null;
}

function verticalRank(position) {
  if (["G", "GK"].includes(position)) return -1;
  if (["LB", "LWB", "RB", "RWB", "CD", "CB", "CD-L", "CB-L", "CD-R", "CB-R"].includes(position)) return 0;
  if (["DM", "CDM"].includes(position)) return 1;
  if (["LM", "RM", "CM", "CM-L", "CM-R"].includes(position)) return 2;
  if (["AM", "CAM", "CF-L", "CF-R"].includes(position)) return 3;
  return 4;
}

function sideRank(position) {
  if (["LB", "LWB", "LM", "LW", "LF"].includes(position)) return 10;
  if (/-(L)$/.test(position)) return 30;
  if (/-(R)$/.test(position)) return 70;
  if (["RB", "RWB", "RM", "RW", "RF"].includes(position)) return 90;
  return 50;
}

function sortPlayersForLayout(players) {
  return players
    .map((player, index) => ({ ...player, index }))
    .sort((a, b) => (
      verticalRank(a.positionAbbreviation) - verticalRank(b.positionAbbreviation) ||
      sideRank(a.positionAbbreviation) - sideRank(b.positionAbbreviation) ||
      a.index - b.index
    ));
}

function fallbackRows(players) {
  const rows = [];
  for (const rank of [0, 1, 2, 3, 4]) {
    const row = players.filter((player) => verticalRank(player.positionAbbreviation) === rank);
    if (row.length) rows.push(row);
  }
  return rows;
}

function formationRows(players, formation) {
  const counts = parseFormation(formation, players.length);
  if (!counts) return fallbackRows(players);

  const rows = [];
  let offset = 0;
  for (const count of counts) {
    rows.push(players.slice(offset, offset + count));
    offset += count;
  }
  return rows;
}

function rowWidth(count) {
  if (count >= 5) return 150;
  if (count === 4) return 164;
  if (count === 3) return 176;
  return 188;
}

function spreadRow(players, y) {
  const xs = XS_BY_COUNT[Math.min(players.length, 5)] ?? XS_BY_COUNT[5];
  return players.map((player, index) => ({
    x: xs[index] ?? (110 + index * 140),
    y,
    pos: displayPosition(player.positionAbbreviation),
    width: rowWidth(players.length),
    name: player.name,
  }));
}

export function resolveLineupSlots(players, formation) {
  const sorted = sortPlayersForLayout(players);
  const goalkeeper = sorted.find((player) => ["G", "GK"].includes(player.positionAbbreviation)) ?? sorted[0];
  const outfield = sorted.filter((player) => player !== goalkeeper);
  const rows = formationRows(outfield, formation);
  const rowYs = ROW_YS_BY_COUNT[rows.length] ?? ROW_YS_BY_COUNT[4];

  return [
    { x: 450, y: 900, pos: "GK", width: 208, name: goalkeeper.name },
    ...rows.flatMap((row, index) => spreadRow(row, rowYs[index] ?? 500)),
  ];
}

function commonDefs() {
  return `<defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b7a43"/>
      <stop offset="1" stop-color="#075f34"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#062818" flood-opacity=".35"/>
    </filter>
    <style>
      .title { font: 800 36px Roboto, sans-serif; fill: #f7fff8; }
      .match-title { font: 800 46px Roboto, sans-serif; fill: #f7fff8; }
      .meta { font: 600 21px Roboto, sans-serif; fill: #d8f6df; }
      .line { stroke: rgba(255,255,255,.76); stroke-width: 4; fill: none; }
      .thin { stroke: rgba(255,255,255,.48); stroke-width: 2; fill: none; }
      .card { fill: #f4fff7; stroke: rgba(4,57,34,.55); stroke-width: 2; }
      .pos { font: 800 15px Roboto, sans-serif; fill: #075331; }
      .name { font: 800 20px Roboto, sans-serif; fill: #073c27; }
      .bench-title { font: 800 20px Roboto, sans-serif; fill: #f7fff8; }
      .bench { font: 600 20px Roboto, sans-serif; fill: #d8f6df; }
      .flag-code { font: 800 20px Roboto, sans-serif; fill: #f7fff8; }
    </style>
  </defs>`;
}

function flag({ x, y, url, code }) {
  const normalizedCode = String(code || "").toLowerCase();
  if (normalizedCode === "mx") {
    return `<g transform="translate(${x - 36} ${y - 24})">
      <rect width="72" height="48" rx="6" fill="#fff" stroke="rgba(255,255,255,.38)"/>
      <rect width="24" height="48" rx="6" fill="#006847"/>
      <rect x="48" width="24" height="48" rx="6" fill="#ce1126"/>
      <circle cx="36" cy="24" r="5" fill="#8c6b2f"/>
    </g>`;
  }
  if (normalizedCode === "za") {
    return `<g transform="translate(${x - 36} ${y - 24})">
      <rect width="72" height="48" rx="6" fill="#de3831" stroke="rgba(255,255,255,.38)"/>
      <rect y="24" width="72" height="24" rx="6" fill="#002395"/>
      <path d="M0 0 L34 24 L0 48 Z" fill="#000"/>
      <path d="M0 5 L27 24 L0 43 L0 34 L15 24 L0 14 Z" fill="#ffb612"/>
      <path d="M0 10 L20 24 L0 38 L0 30 L9 24 L0 18 Z" fill="#007a4d"/>
      <path d="M20 18 H72 V30 H20 L11 24 Z" fill="#007a4d"/>
      <path d="M25 14 H72 V18 H20 Z M20 30 H72 V34 H25 Z" fill="#fff"/>
    </g>`;
  }
  const image = url
    ? `<image x="${x - 32}" y="${y - 22}" width="64" height="44" href="${escapeXml(url)}" xlink:href="${escapeXml(url)}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  return `<g>
    <rect x="${x - 36}" y="${y - 24}" width="72" height="48" rx="6" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.38)"/>
    ${image}
    <text x="${x}" y="${y + 8}" text-anchor="middle" class="flag-code">${escapeXml(String(code || "").toUpperCase())}</text>
  </g>`;
}

function lineupPanel({ teamName, opponentName, formation, kickoffLabel, starters, substitutes, flagUrl, flagCode, layout }) {
  const starterCards = (layout ?? resolveLineupSlots(starters, formation)).map(card).join("");
  const subtitle = `${teamName} lineup / ${formation || "formation TBD"} / ${kickoffLabel}`;

  return `
  <rect x="48" y="44" width="804" height="1112" rx="30" fill="url(#grass)" filter="url(#shadow)"/>
  ${flag({ x: 450, y: 82, url: flagUrl, code: flagCode })}
  <text x="450" y="128" text-anchor="middle" class="title">${escapeXml(teamName)}</text>
  <text x="450" y="160" text-anchor="middle" class="meta">${escapeXml(subtitle)}</text>
  <rect x="94" y="178" width="712" height="782" rx="10" class="line"/>
  <line x1="94" y1="178" x2="806" y2="178" class="thin"/>
  <line x1="94" y1="960" x2="806" y2="960" class="line"/>
  <path d="M332 178 A118 118 0 0 0 568 178" class="thin"/>
  <circle cx="450" cy="178" r="6" fill="rgba(255,255,255,.8)"/>
  <rect x="242" y="826" width="416" height="134" class="line"/>
  <rect x="348" y="908" width="204" height="52" class="thin"/>
  <path d="M346 826 A104 104 0 0 1 554 826" class="thin"/>
  ${starterCards}
  <rect x="84" y="1002" width="732" height="104" rx="18" fill="rgba(6,42,27,.74)" stroke="rgba(216,246,223,.3)"/>
  <text x="112" y="1040" class="bench-title">Bench</text>
  ${benchText(substitutes)}
  <text x="450" y="1140" text-anchor="middle" class="meta">vs ${escapeXml(opponentName)} / Official lineup</text>`;
}

export function buildLineupSvg(props) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" role="img" aria-label="${escapeXml(props.teamName)} lineup">
  ${commonDefs()}
  <rect width="900" height="1200" fill="#052f20"/>
  ${lineupPanel(props)}
</svg>`;
}

export function buildMatchLineupSvg({ title, kickoffLabel, lineups }) {
  const [home, away] = lineups;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1800" height="1120" viewBox="0 0 1800 1120" role="img" aria-label="${escapeXml(title)} lineups">
  ${commonDefs()}
  <rect width="1800" height="1120" fill="#052f20"/>
  <text x="900" y="54" text-anchor="middle" class="match-title">${escapeXml(title)}</text>
  <text x="900" y="88" text-anchor="middle" class="meta">${escapeXml(kickoffLabel)} / Official lineups</text>
  <g transform="translate(16 88) scale(0.86)">${lineupPanel(home)}</g>
  <g transform="translate(908 88) scale(0.86)">${lineupPanel(away)}</g>
</svg>`;
}

export async function renderLineupPng(svg, width = 900) {
  const { renderLineupPngInWorker } = await import("./lineup-renderer-worker.js");
  return renderLineupPngInWorker(svg, width);
}
