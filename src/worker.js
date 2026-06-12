import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { buildLineupImage, buildLineupImagePayload, buildLineupPayload } from "./lineup.js";
import { buildNotablePayloads, buildPlayerPayloads, buildPositionsPayloads, buildSquadPayloads } from "./player-data.js";
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

function interactionMessageResponse(payload) {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: textOnlyPayload(payload),
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
  const { body, headers } = discordRequestBody(payload);
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord original response edit error: ${res.status} ${await res.text()}`);
  }
}

async function createFollowupMessage(interaction, payload) {
  const url = `${DISCORD_API_BASE}/webhooks/${interaction.application_id}/${interaction.token}`;
  const { body, headers } = discordRequestBody(payload);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord follow-up error: ${res.status} ${await res.text()}`);
  }
}

function textOnlyPayload(payload) {
  const { files, ...textPayload } = payload;
  return textPayload;
}

function hasVisiblePayloadBody(payload) {
  return Boolean(payload.content || payload.embeds?.length || payload.components?.length);
}

function discordRequestBody(payload) {
  if (!payload.files?.length) {
    return {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }

  const { files, ...jsonPayload } = payload;
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    ...jsonPayload,
    attachments: files.map((file, id) => ({ id, filename: file.name })),
  }));
  files.forEach((file, index) => {
    form.append(`files[${index}]`, new Blob([file.data], { type: file.type }), file.name);
  });
  return { headers: {}, body: form };
}

async function sendPayload(interaction, payload, isFirst) {
  const files = payload.files ?? [];
  let messagePayload = payload;
  const textPayload = textOnlyPayload(payload);
  console.log("Sending Discord payload", {
    isFirst,
    hasText: hasVisiblePayloadBody(textPayload),
    fileCount: files.length,
  });

  if (isFirst) {
    if (!hasVisiblePayloadBody(textPayload) && !files.length) {
      messagePayload = { content: "処理しました。", allowed_mentions: { parse: [] } };
    } else if (!hasVisiblePayloadBody(textPayload)) {
      messagePayload = { ...payload, content: "画像を送信します。", allowed_mentions: { parse: [] } };
    }
    await editOriginalInteractionResponse(interaction, messagePayload);
  } else if (hasVisiblePayloadBody(textPayload) || files.length) {
    await createFollowupMessage(interaction, messagePayload);
  }
}

async function sendPayloads(interaction, payloads) {
  const normalizedPayloads = Array.isArray(payloads) ? payloads : [payloads];
  console.log("Sending payload set", { count: normalizedPayloads.length });
  for (const [index, payload] of normalizedPayloads.entries()) {
    await sendPayload(interaction, payload, index === 0);
  }
}

async function respondToWorldCupCommand(interaction) {
  try {
    const subcommand = interaction.data?.options?.[0];
    console.log("Handling /wc command", {
      id: interaction.id,
      subcommand: subcommand?.name ?? "today",
    });
    let payloads;

    if (!subcommand || ["today", "tomorrow", "date"].includes(subcommand.name)) {
      payloads = await buildDiscordPayloadForDate(targetDateFromCommand(interaction));
    } else if (subcommand.name === "squad") {
      payloads = buildSquadPayloads(optionValue(subcommand.options, "team"), optionValue(subcommand.options, "position"));
    } else if (subcommand.name === "player") {
      payloads = buildPlayerPayloads(optionValue(subcommand.options, "name"));
    } else if (subcommand.name === "positions") {
      payloads = buildPositionsPayloads(optionValue(subcommand.options, "team"));
    } else if (subcommand.name === "notable") {
      payloads = buildNotablePayloads({
        teamQuery: optionValue(subcommand.options, "team"),
        positionQuery: optionValue(subcommand.options, "position"),
        limit: optionValue(subcommand.options, "limit"),
      });
    } else if (subcommand.name === "results") {
      payloads = await buildResultsPayloads(dateOptionOrToday(subcommand.options));
    } else if (subcommand.name === "standings") {
      payloads = await buildStandingsPayloads();
    } else if (subcommand.name === "summary") {
      payloads = await buildDailySummaryPayloads(dateOptionOrToday(subcommand.options));
    } else if (subcommand.name === "japan") {
      payloads = await buildTeamSchedulePayloads("Japan", optionValue(subcommand.options, "scope") ?? "future");
    } else if (subcommand.name === "lineup") {
      payloads = await buildLineupPayload(optionValue(subcommand.options, "team"), { attachImage: true });
    } else {
      throw new Error(`Unsupported subcommand: ${subcommand.name}`);
    }

    await sendPayloads(interaction, payloads);
    console.log("Finished /wc command", {
      id: interaction.id,
      subcommand: subcommand?.name ?? "today",
    });
  } catch (err) {
    console.error("Failed /wc command", {
      id: interaction.id,
      message: err.message,
      stack: err.stack,
    });
    await editOriginalInteractionResponse(interaction, {
      content: `試合予定を取得できませんでした: ${err.message}`,
      allowed_mentions: { parse: [] },
    });
  }
}

async function updateLineupImageMessage(interaction, teamQuery, env) {
  try {
    console.log("Building /wc lineup image update", { id: interaction.id });
    const payload = await buildLineupImagePayload(teamQuery, { geminiApiKey: env.GEMINI_API_KEY });
    if (!payload) {
      console.log("Skipping /wc lineup image follow-up; no official lineups", { id: interaction.id });
      return;
    }
    console.log("Updating /wc lineup original message with image", {
      id: interaction.id,
      fileCount: payload.files?.length ?? 0,
      bytes: payload.files?.[0]?.data?.byteLength ?? payload.files?.[0]?.data?.length ?? 0,
    });
    await editOriginalInteractionResponse(interaction, payload);
  } catch (err) {
    console.error("Failed /wc lineup image update", {
      id: interaction.id,
      message: err.message,
      stack: err.stack,
    });
    const errorPayload = {
      content: `スタメン画像を送信できませんでした: ${err.message}`,
      allowed_mentions: { parse: [] },
    };
    await editOriginalInteractionResponse(interaction, errorPayload);
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
  console.log("Received Discord interaction", {
    id: interaction.id,
    type: interaction.type,
    name: interaction.data?.name,
  });
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

  const subcommand = interaction.data?.options?.[0];
  if (subcommand?.name === "lineup") {
    const teamQuery = optionValue(subcommand.options, "team");
    const textOnly = optionValue(subcommand.options, "text") === true;
    try {
      if (textOnly) {
        return interactionMessageResponse(await buildLineupPayload(teamQuery, { textOnly: true }));
      }
      const payload = await buildLineupPayload(teamQuery, { summaryOnly: true });
      if (payload.content?.includes("公式スタメン")) {
        ctx.waitUntil(updateLineupImageMessage(interaction, teamQuery, env));
      }
      return interactionMessageResponse(payload);
    } catch (err) {
      console.error("Failed immediate /wc lineup response", {
        id: interaction.id,
        message: err.message,
        stack: err.stack,
      });
      return interactionMessageResponse({
        content: `スタメンを取得できませんでした: ${err.message}`,
        allowed_mentions: { parse: [] },
      });
    }
  }

  ctx.waitUntil(respondToWorldCupCommand(interaction));
  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/lineup-image") {
        try {
          const image = await buildLineupImage(url.searchParams.get("event"), url.searchParams.get("team"), {
            geminiApiKey: env.GEMINI_API_KEY,
          });
          return new Response(image.data, {
            headers: {
              "Content-Type": "image/png",
              "Content-Disposition": `inline; filename="${image.filename}"`,
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch (err) {
          console.error("Lineup image render failed", {
            message: err?.message ?? String(err),
            stack: err.stack,
          });
          return new Response(`Lineup image render failed: ${err?.message ?? String(err)}`, { status: 500 });
        }
      }
      return new Response("World Cup 2026 scheduler worker is running.");
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed.", { status: 405 });
    }

    return handleInteraction(request, env, ctx);
  },
};
