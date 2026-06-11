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
  const fontSize = safeName.length > 15 ? 17 : safeName.length > 12 ? 18 : 20;
  return `
  <g transform="translate(${x} ${y})">
    <rect x="${-width / 2}" y="-34" width="${width}" height="68" rx="18" class="card"/>
    <text x="0" y="-8" text-anchor="middle" class="pos">${escapeXml(pos)}</text>
    <text x="0" y="21" text-anchor="middle" class="name" style="font-size:${fontSize}px">${escapeXml(safeName)}</text>
  </g>`;
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
  CM: { x: 450, y: 585, pos: "CM", width: 184 },
  "CM-L": { x: 350, y: 585, pos: "CM", width: 184 },
  "CM-R": { x: 550, y: 585, pos: "CM", width: 184 },
  DM: { x: 550, y: 585, pos: "DM", width: 184 },
  CDM: { x: 550, y: 585, pos: "DM", width: 184 },
  AM: { x: 450, y: 420, pos: "AM", width: 184 },
  CAM: { x: 450, y: 420, pos: "AM", width: 184 },
  LF: { x: 176, y: 414, pos: "LW", width: 164 },
  RF: { x: 724, y: 414, pos: "RW", width: 164 },
  F: { x: 450, y: 270, pos: "CF", width: 188 },
  CF: { x: 450, y: 270, pos: "CF", width: 188 },
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
  return players.map((player, index) => {
    const abbreviation = player.positionAbbreviation;
    const base = POSITION_COORDS[abbreviation] ?? FALLBACK_SLOTS[index] ?? FALLBACK_SLOTS.at(-1);
    const key = `${base.x}:${base.y}`;
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    const xOffset = count === 0 ? 0 : count % 2 === 1 ? -96 : 96;
    const yOffset = count === 0 ? 0 : Math.ceil(count / 2) * 20;
    return { ...base, x: base.x + xOffset, y: base.y + yOffset, name: player.name };
  });
}

export function buildLineupSvg({ teamName, opponentName, formation, kickoffLabel, starters, substitutes }) {
  const starterCards = resolveSlots(starters).map(card).join("");
  const bench = substitutes.map((player) => shortName(player.name)).slice(0, 10).join(", ");
  const subtitle = `${teamName} lineup / ${formation || "formation TBD"} / ${kickoffLabel}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" role="img" aria-label="${escapeXml(teamName)} lineup">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b7a43"/>
      <stop offset="1" stop-color="#075f34"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#062818" flood-opacity=".35"/>
    </filter>
    <style>
      .title { font: 800 34px Arial, sans-serif; fill: #f7fff8; }
      .meta { font: 600 20px Arial, sans-serif; fill: #d8f6df; }
      .line { stroke: rgba(255,255,255,.76); stroke-width: 4; fill: none; }
      .thin { stroke: rgba(255,255,255,.48); stroke-width: 2; fill: none; }
      .card { fill: #f4fff7; stroke: rgba(4,57,34,.55); stroke-width: 2; }
      .pos { font: 800 15px Arial, sans-serif; fill: #075331; }
      .name { font: 800 20px Arial, sans-serif; fill: #073c27; }
      .bench-title { font: 800 20px Arial, sans-serif; fill: #f7fff8; }
      .bench { font: 600 17px Arial, sans-serif; fill: #d8f6df; }
    </style>
  </defs>
  <rect width="900" height="1200" fill="#052f20"/>
  <rect x="48" y="44" width="804" height="1112" rx="30" fill="url(#grass)" filter="url(#shadow)"/>
  <text x="450" y="102" text-anchor="middle" class="title">${escapeXml(teamName)} vs ${escapeXml(opponentName)}</text>
  <text x="450" y="136" text-anchor="middle" class="meta">${escapeXml(subtitle)}</text>
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
  <text x="112" y="1074" class="bench">${escapeXml(bench || "Not available")}</text>
  <text x="450" y="1140" text-anchor="middle" class="meta">Official lineup</text>
</svg>`;
}

export async function renderLineupPng(svg) {
  const { renderLineupPngInWorker } = await import("./lineup-renderer-worker.js");
  return renderLineupPngInWorker(svg);
}
