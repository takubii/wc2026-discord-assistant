import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { buildDiscordPayloadForDate, todayInTokyo, tomorrowInTokyo } from "./schedule.js";

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

async function respondToWorldCupCommand(interaction) {
  try {
    const payload = await buildDiscordPayloadForDate(targetDateFromCommand(interaction));
    await editOriginalInteractionResponse(interaction, payload);
  } catch (err) {
    await editOriginalInteractionResponse(interaction, {
      content: `試合予定を取得できませんでした: ${err.message}`,
      allowed_mentions: { parse: [] },
    });
  }
}

async function handleInteraction(request, env, ctx) {
  const body = await request.text();
  const isValid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, body);
  if (!isValid) {
    return new Response("Bad request signature.", { status: 401 });
  }

  const interaction = JSON.parse(body);
  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
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
