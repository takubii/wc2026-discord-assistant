import { resolveLineupSlots } from "./lineup-renderer.js";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const XS_BY_COUNT = {
  1: [450],
  2: [330, 570],
  3: [240, 450, 660],
  4: [146, 350, 550, 754],
  5: [124, 300, 450, 600, 776],
};

const KNOWN_POSITIONS = new Set([
  "G",
  "GK",
  "LB",
  "LWB",
  "RB",
  "RWB",
  "CD",
  "CB",
  "CD-L",
  "CB-L",
  "CD-R",
  "CB-R",
  "DM",
  "CDM",
  "CM",
  "CM-L",
  "CM-R",
  "LM",
  "RM",
  "AM",
  "CAM",
  "LW",
  "RW",
  "LF",
  "RF",
  "F",
  "CF",
  "CF-L",
  "CF-R",
  "ST",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapPercentToPitch({ x, y }) {
  return {
    x: Math.round(94 + clamp(Number(x), 5, 95) * 7.12),
    y: Math.round(178 + clamp(Number(y), 8, 92) * 7.82),
  };
}

function overlapIssue(slots) {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      const minX = ((a.width ?? 176) + (b.width ?? 176)) / 2 - 6;
      if (Math.abs(a.x - b.x) < minX && Math.abs(a.y - b.y) < 76) {
        return true;
      }
    }
  }
  return false;
}

function layoutIssue(starters, formation, slots) {
  if (starters.length !== 11 || slots.length !== 11) return "invalid-player-count";
  if (starters.some((player) => !KNOWN_POSITIONS.has(player.positionAbbreviation))) return "unknown-position";
  if (!String(formation ?? "").match(/\d+/g)) return "missing-formation";
  if (overlapIssue(slots)) return "overlap";
  return "";
}

function promptForLayout({ teamName, formation, starters, issue }) {
  const players = starters.map((player) => ({
    name: player.name,
    position: player.positionAbbreviation,
  }));
  return [
    "You are a football lineup layout planner.",
    "Return JSON only. Do not generate SVG.",
    "Place exactly 11 input players on a vertical football pitch.",
    "Coordinates are percentages: x 0 is left, x 100 is right, y 0 is opponent goal, y 100 is own goal.",
    "Avoid overlapping player cards. Players in the same horizontal row should usually be at least 25 x-points apart.",
    "Use the full pitch width: 4-player rows can use x around 12, 36, 64, 88; 3-player rows can use x around 22, 50, 78; 2-player rows can use x around 34, 66.",
    "Respect formation and position abbreviations.",
    "Use short labels like GK, CB, LB, RB, DM, CM, AM, LW, RW, CF.",
    "",
    `team: ${teamName}`,
    `formation: ${formation || "unknown"}`,
    `reason_for_ai_layout: ${issue}`,
    `players: ${JSON.stringify(players)}`,
    "",
    'JSON shape: {"players":[{"name":"same as input","label":"CF","x":50,"y":25}]}',
  ].join("\n");
}

function parseGeminiText(data) {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no layout text");
  return JSON.parse(text);
}

function normalizeAiLayout(parsed, starters) {
  const byName = new Map(starters.map((player) => [player.name, player]));
  const items = parsed.players;
  if (!Array.isArray(items) || items.length !== starters.length) {
    throw new Error("Gemini layout has invalid player count");
  }

  const slots = items.map((item) => {
    const player = byName.get(item.name);
    if (!player) throw new Error(`Gemini layout contains unknown player: ${item.name}`);
    const point = mapPercentToPitch(item);
    return {
      ...point,
      pos: String(item.label || player.positionAbbreviation || "").slice(0, 6),
      width: 176,
      name: player.name,
      shirtNumber: player.shirtNumber,
    };
  });

  const fixed = fixRowOverlaps(slots);
  if (overlapIssue(fixed)) {
    throw new Error("Gemini layout overlaps");
  }
  return fixed;
}

function fixRowOverlaps(slots) {
  const rows = [];
  for (const slot of [...slots].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - slot.y) < 84);
    if (row) {
      row.items.push(slot);
      row.y = Math.round((row.y * (row.items.length - 1) + slot.y) / row.items.length);
    } else {
      rows.push({ y: slot.y, items: [slot] });
    }
  }

  return rows.flatMap((row) => {
    const items = row.items.sort((a, b) => a.x - b.x);
    const xs = XS_BY_COUNT[Math.min(items.length, 5)];
    return items.map((item, index) => ({
      ...item,
      x: xs?.[index] ?? item.x,
      y: row.y,
      width: items.length >= 5 ? 150 : items.length === 4 ? 164 : 176,
    }));
  });
}

async function requestGeminiLayout({ apiKey, teamName, formation, starters, issue }) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: promptForLayout({ teamName, formation, starters, issue }) }],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini layout error: ${res.status} ${await res.text()}`);
  }
  return normalizeAiLayout(parseGeminiText(await res.json()), starters);
}

export async function buildLineupLayout({ apiKey, teamName, formation, starters }) {
  const ruleLayout = resolveLineupSlots(starters, formation);
  const issue = layoutIssue(starters, formation, ruleLayout);
  if (!issue || !apiKey) {
    return { layout: ruleLayout, source: "rule", issue };
  }

  try {
    const layout = await requestGeminiLayout({ apiKey, teamName, formation, starters, issue });
    return { layout, source: "gemini", issue };
  } catch (err) {
    console.error("Gemini lineup layout failed; using rule layout", {
      teamName,
      issue,
      message: err.message,
    });
    return { layout: ruleLayout, source: "rule-fallback", issue };
  }
}
