import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { buildPlayerPayloads, buildPositionsPayloads, buildSquadPayloads } from "./player-data.js";
import { buildDailySummaryPayloads, buildResultsPayloads, buildStandingsPayloads, buildTeamSchedulePayloads } from "./results.js";
import { buildDiscordPayloadForDate, todayInTokyo, tomorrowInTokyo } from "./schedule.js";
import { teamChoices } from "./team-data.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyDiscordRequest(request, publicKey, body) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp || !publicKey) return false;
  return verifyKey(body, signature, timestamp, publicKey);
}

function optionValue(options, name) {
  return options?.find((option) => option.name === name)?.value;
}

function dateOptionOrToday(options) {
  const value = optionValue(options, "date");
  if (!value) return todayInTokyo();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日付は YYYY-MM-DD 形式で指定してください。例: 2026-06-14");
  }
  return value;
}

function targetDateFromCommand(interaction) {
  const subcommand = interaction.data?.options?.[0];
  if (!subcommand || subcommand.name === "today") return todayInTokyo();
  if (subcommand.name === "tomorrow") return tomorrowInTokyo();
  if (subcommand.name === "date") {
    const value = optionValue(subcommand.options, "value");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
      throw new Error("日付は YYYY-MM-DD 形式で指定してください。例: 2026-06-14");
    }
    return value;
  }
  throw new Error(`Unsupported subcommand: ${subcommand.name}`);
}

async function editOriginalInteractionResponse(interaction, payload) {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Discord follow-up error: ${res.status} ${await res.text()}`);
  }
}

async function createFollowupMessage(interaction, payload) {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Discord follow-up error: ${res.status} ${await res.text()}`);
  }
}

async function sendPayloads(interaction, payloads) {
  const [first, ...rest] = Array.isArray(payloads) ? payloads : [payloads];
  await editOriginalInteractionResponse(interaction, first);
  for (const payload of rest) {
    await createFollowupMessage(interaction, payload);
  }
}

async function respondToWorldCupCommand(interaction) {
  try {
    const subcommand = interaction.data?.options?.[0];
    let payloads;

    if (!subcommand || ["today", "tomorrow", "date"].includes(subcommand.name)) {
      payloads = await buildDiscordPayloadForDate(targetDateFromCommand(interaction));
    } else if (subcommand.name === "squad") {
      payloads = buildSquadPayloads(optionValue(subcommand.options, "team"), optionValue(subcommand.options, "position"));
    } else if (subcommand.name === "player") {
      payloads = buildPlayerPayloads(optionValue(subcommand.options, "name"));
    } else if (subcommand.name === "positions") {
      payloads = buildPositionsPayloads(optionValue(subcommand.options, "team"));
    } else if (subcommand.name === "results") {
      payloads = await buildResultsPayloads(dateOptionOrToday(subcommand.options));
    } else if (subcommand.name === "standings") {
      payloads = await buildStandingsPayloads();
    } else if (subcommand.name === "summary") {
      payloads = await buildDailySummaryPayloads(dateOptionOrToday(subcommand.options));
    } else if (subcommand.name === "japan") {
      payloads = await buildTeamSchedulePayloads("Japan", optionValue(subcommand.options, "scope") ?? "future");
    } else {
      throw new Error(`Unsupported subcommand: ${subcommand.name}`);
    }

    await sendPayloads(interaction, payloads);
  } catch (err) {
    await editOriginalInteractionResponse(interaction, {
      content: `試合予定を取得できませんでした: ${err.message}`,
      allowed_mentions: { parse: [] },
    });
  }
}

function focusedOption(options = []) {
  for (const option of options) {
    if (option.focused) return option;
    const child = focusedOption(option.options);
    if (child) return child;
  }
  return null;
}

function autocompleteResponse(interaction) {
  const focused = focusedOption(interaction.data?.options);
  if (focused?.name === "team") {
    return jsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: teamChoices(focused.value) },
    });
  }

  return jsonResponse({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices: [] },
  });
}

async function handleInteraction(request, env, ctx) {
  const body = await request.arrayBuffer();
  const isValid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, body);
  if (!isValid) {
    return new Response("Bad request signature.", { status: 401 });
  }

  const interaction = JSON.parse(new TextDecoder().decode(body));
  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE && interaction.data?.name === "wc") {
    return autocompleteResponse(interaction);
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND || interaction.data?.name !== "wc") {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Unsupported command.",
        flags: 64,
      },
    });
  }

  ctx.waitUntil(respondToWorldCupCommand(interaction));
  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("World Cup 2026 scheduler worker is running.");
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed.", { status: 405 });
    }

    return handleInteraction(request, env, ctx);
  },
};
