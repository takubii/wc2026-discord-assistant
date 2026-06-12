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

const POSITION_COORDS = {
  G: { x: 450, y: 900, pos: "GK", width: 208 },
  GK: { x: 450, y: 900, pos: "GK", width: 208 },
  LB: { x: 146, y: 750, pos: "LB", width: 168 },
  LWB: { x: 146, y: 706, pos: "LWB", width: 168 },
  RB: { x: 754, y: 750, pos: "RB", width: 176 },
  RWB: { x: 754, y: 706, pos: "RWB", width: 176 },
  CD: { x: 450, y: 762, pos: "CB", width: 176 },
  CB: { x: 450, y: 762, pos: "CB", width: 176 },
  "CD-L": { x: 350, y: 762, pos: "CB", width: 176 },
  "CB-L": { x: 350, y: 762, pos: "CB", width: 176 },
  "CD-R": { x: 550, y: 762, pos: "CB", width: 184 },
  "CB-R": { x: 550, y: 762, pos: "CB", width: 184 },
  LM: { x: 176, y: 414, pos: "LW", width: 164 },
  LW: { x: 176, y: 414, pos: "LW", width: 164 },
  RM: { x: 724, y: 414, pos: "RW", width: 164 },
  RW: { x: 724, y: 414, pos: "RW", width: 164 },
  CM: { x: 450, y: 560, pos: "CM", width: 184 },
  "CM-L": { x: 330, y: 560, pos: "CM", width: 184 },
  "CM-R": { x: 570, y: 560, pos: "CM", width: 184 },
  DM: { x: 450, y: 650, pos: "DM", width: 184 },
  CDM: { x: 450, y: 650, pos: "DM", width: 184 },
  AM: { x: 450, y: 420, pos: "AM", width: 184 },
  CAM: { x: 450, y: 420, pos: "AM", width: 184 },
  LF: { x: 176, y: 414, pos: "LW", width: 164 },
  RF: { x: 724, y: 414, pos: "RW", width: 164 },
  F: { x: 450, y: 270, pos: "CF", width: 188 },
  CF: { x: 450, y: 270, pos: "CF", width: 188 },
  "CF-L": { x: 350, y: 270, pos: "CF", width: 176 },
  "CF-R": { x: 550, y: 270, pos: "CF", width: 176 },
  ST: { x: 450, y: 270, pos: "CF", width: 188 },
};

const FALLBACK_SLOTS = [
  { x: 450, y: 900, pos: "GK", width: 208 },
  { x: 146, y: 750, pos: "LB", width: 168 },
  { x: 350, y: 762, pos: "CB", width: 176 },
  { x: 550, y: 762, pos: "CB", width: 184 },
  { x: 754, y: 750, pos: "RB", width: 176 },
  { x: 350, y: 585, pos: "CM", width: 184 },
  { x: 550, y: 585, pos: "CM", width: 184 },
  { x: 176, y: 414, pos: "LW", width: 164 },
  { x: 450, y: 420, pos: "AM", width: 184 },
  { x: 724, y: 414, pos: "RW", width: 164 },
  { x: 450, y: 270, pos: "CF", width: 188 },
];

function resolveSlots(players) {
  const used = new Map();
  const abbreviations = new Set(players.map((player) => player.positionAbbreviation));
  const hasBackThree = (abbreviations.has("CD") || abbreviations.has("CB")) &&
    (abbreviations.has("CD-L") || abbreviations.has("CB-L")) &&
    (abbreviations.has("CD-R") || abbreviations.has("CB-R"));
  const hasMidThree = abbreviations.has("CM") && abbreviations.has("CM-L") && abbreviations.has("CM-R");
  const hasCentralForward = abbreviations.has("F") || abbreviations.has("CF") || abbreviations.has("ST");
  const hasShadowForwards = hasCentralForward && abbreviations.has("CF-L") && abbreviations.has("CF-R");
  return players.map((player, index) => {
    const abbreviation = player.positionAbbreviation;
    let base = POSITION_COORDS[abbreviation] ?? FALLBACK_SLOTS[index] ?? FALLBACK_SLOTS.at(-1);
    if (hasShadowForwards && ["F", "CF", "ST"].includes(abbreviation)) {
      base = { ...base, x: 450, y: 270, width: 176 };
    }
    if (hasShadowForwards && abbreviation === "CF-L") {
      base = { ...base, x: 360, y: 388, width: 176 };
    }
    if (hasShadowForwards && abbreviation === "CF-R") {
      base = { ...base, x: 540, y: 388, width: 176 };
    }
    if (hasBackThree && abbreviation === "LB") {
      base = { ...base, x: 124, width: 150 };
    }
    if (hasBackThree && abbreviation === "RB") {
      base = { ...base, x: 776, width: 150 };
    }
    if (hasBackThree && (abbreviation === "CD-L" || abbreviation === "CB-L")) {
      base = { ...base, x: 300, width: 150 };
    }
    if (hasBackThree && (abbreviation === "CD" || abbreviation === "CB")) {
      base = { ...base, x: 450, width: 150 };
    }
    if (hasBackThree && (abbreviation === "CD-R" || abbreviation === "CB-R")) {
      base = { ...base, x: 600, width: 150 };
    }
    if (hasMidThree && abbreviation === "CM-L") {
      base = { ...base, x: 240, width: 168 };
    }
    if (hasMidThree && abbreviation === "CM") {
      base = { ...base, x: 450, width: 168 };
    }
    if (hasMidThree && abbreviation === "CM-R") {
      base = { ...base, x: 660, width: 168 };
    }
    const key = `${base.x}:${base.y}`;
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    const xOffset = count === 0 ? 0 : count % 2 === 1 ? -230 : 230;
    const yOffset = count === 0 ? 0 : Math.ceil(count / 2) * 20;
    return { ...base, x: base.x + xOffset, y: base.y + yOffset, name: player.name };
  });
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

function lineupPanel({ teamName, opponentName, formation, kickoffLabel, starters, substitutes, flagUrl, flagCode }) {
  const starterCards = resolveSlots(starters).map(card).join("");
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
