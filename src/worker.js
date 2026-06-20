import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { buildFifaRankingsPayloads } from "./fifa-rankings.js";
import { buildLineupImage, buildLineupImagePayload, buildLineupPayload, buildLineupPayloadForEvent, upcomingLineupReminderEvents } from "./lineup.js";
import { buildNotablePayloads, buildPlayerPayloads, buildPositionsPayloads, buildTeamPayloads, positionChoices } from "./player-data.js";
import { buildDailySummaryPayloads, buildGroupStandingsPayloads, buildResultsPayloads, buildStandingsPayloads, buildTeamSchedulePayloads } from "./results.js";
import { buildDiscordPayloadForDate, todayInTokyo, tomorrowInTokyo } from "./schedule.js";
import { teamChoices } from "./team-data.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MANAGE_GUILD_PERMISSION = 0x20n;

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

function hasManageGuildPermission(interaction) {
  try {
    const permissions = BigInt(interaction.member?.permissions ?? "0");
    return (permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
  } catch {
    return false;
  }
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

async function postWebhookPayload(webhookUrl, payload) {
  if (!webhookUrl) {
    throw new Error("Discord webhook URL is not configured");
  }

  const payloads = splitWebhookPayload(textOnlyPayload(payload));
  for (const webhookPayload of payloads) {
    await postSingleWebhookPayload(webhookUrl, webhookPayload);
  }
}

async function postBotPayload(env, channelId, payload) {
  if (!env.DISCORD_BOT_TOKEN) {
    throw new Error("Discord bot token is not configured");
  }
  if (!channelId) {
    throw new Error("Discord channel ID is not configured");
  }

  const payloads = splitWebhookPayload(textOnlyPayload(payload));
  for (const botPayload of payloads) {
    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(botPayload),
    });

    if (!res.ok) {
      throw new Error(`Discord channel message error: ${res.status} ${await res.text()}`);
    }
  }
}

async function postSingleWebhookPayload(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status} ${await res.text()}`);
  }
}

function splitWebhookPayload(payload) {
  const content = payload.content ?? "";
  if (content.length <= 1900) return [payload];

  const chunks = [];
  let current = "";
  for (const line of content.split("\n")) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > 1900 && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((chunk, index) => ({
    ...payload,
    content: index === 0 ? chunk : `（続き）\n${chunk}`,
  }));
}

async function allGuildSettings(env, filter = {}) {
  if (!env.DB) return [];

  const clauses = [];
  if (filter.dailyEnabled) clauses.push("daily_enabled = 1 AND (schedule_channel_id IS NOT NULL OR results_channel_id IS NOT NULL)");
  if (filter.lineupEnabled) clauses.push("lineup_enabled = 1 AND (lineup_channel_id IS NOT NULL OR schedule_channel_id IS NOT NULL)");
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const result = await env.DB.prepare(`SELECT * FROM guild_settings${where} ORDER BY guild_id`).all();
  return result.results ?? [];
}

async function guildSettings(env, guildId) {
  if (!env.DB || !guildId) return null;
  return env.DB.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").bind(guildId).first();
}

async function upsertGuildChannels(env, { guildId, scheduleChannelId, resultsChannelId, lineupChannelId }) {
  if (!env.DB) throw new Error("D1 database is not configured");
  await env.DB.prepare(`
    INSERT INTO guild_settings (
      guild_id,
      schedule_channel_id,
      results_channel_id,
      lineup_channel_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      schedule_channel_id = excluded.schedule_channel_id,
      results_channel_id = excluded.results_channel_id,
      lineup_channel_id = excluded.lineup_channel_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(guildId, scheduleChannelId, resultsChannelId, lineupChannelId).run();
}

async function updateGuildToggle(env, guildId, column, enabled) {
  if (!env.DB) throw new Error("D1 database is not configured");
  if (!["daily_enabled", "lineup_enabled"].includes(column)) {
    throw new Error(`Unsupported setting: ${column}`);
  }
  await env.DB.prepare(`
    INSERT INTO guild_settings (
      guild_id,
      ${column},
      created_at,
      updated_at
    )
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      ${column} = excluded.${column},
      updated_at = CURRENT_TIMESTAMP
  `).bind(guildId, enabled ? 1 : 0).run();
}

function channelMention(channelId) {
  return channelId ? `<#${channelId}>` : "未設定";
}

function setupStatusContent(settings) {
  if (!settings) {
    return [
      "# ⚙️ WC Bot設定",
      "このサーバーの自動投稿はまだ設定されていません。",
      "",
      "`/wc setup channels` で投稿先チャンネルを設定してください。",
    ].join("\n");
  }

  return [
    "# ⚙️ WC Bot設定",
    `試合日程: ${channelMention(settings.schedule_channel_id)}`,
    `結果: ${channelMention(settings.results_channel_id)}`,
    `スタメン: ${channelMention(settings.lineup_channel_id || settings.schedule_channel_id)}`,
    "",
    `毎日通知: ${settings.daily_enabled ? "有効" : "無効"}`,
    `スタメン通知: ${settings.lineup_enabled ? "有効" : "無効"}`,
  ].join("\n");
}

async function buildSetupPayload(interaction, env) {
  if (!interaction.guild_id) {
    return {
      content: "サーバー内で実行してください。",
      allowed_mentions: { parse: [] },
    };
  }
  if (!hasManageGuildPermission(interaction)) {
    return {
      content: "この設定はサーバー管理権限を持つユーザーだけ実行できます。",
      allowed_mentions: { parse: [] },
    };
  }

  const action = interaction.data?.options?.[0]?.options?.[0];
  if (!action) {
    return {
      content: setupStatusContent(await guildSettings(env, interaction.guild_id)),
      allowed_mentions: { parse: [] },
    };
  }

  if (action.name === "channels") {
    const scheduleChannelId = optionValue(action.options, "schedule");
    const resultsChannelId = optionValue(action.options, "results");
    const lineupChannelId = optionValue(action.options, "lineup") ?? scheduleChannelId;
    await upsertGuildChannels(env, {
      guildId: interaction.guild_id,
      scheduleChannelId,
      resultsChannelId,
      lineupChannelId,
    });
    return {
      content: [
        "# ⚙️ WC Bot設定を保存しました",
        `試合日程: ${channelMention(scheduleChannelId)}`,
        `結果: ${channelMention(resultsChannelId)}`,
        `スタメン: ${channelMention(lineupChannelId)}`,
      ].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }

  if (action.name === "status") {
    return {
      content: setupStatusContent(await guildSettings(env, interaction.guild_id)),
      allowed_mentions: { parse: [] },
    };
  }

  if (action.name === "daily") {
    const enabled = optionValue(action.options, "enabled") === true;
    await updateGuildToggle(env, interaction.guild_id, "daily_enabled", enabled);
    return {
      content: `毎日の試合日程・結果通知を${enabled ? "有効" : "無効"}にしました。`,
      allowed_mentions: { parse: [] },
    };
  }

  if (action.name === "lineup") {
    const enabled = optionValue(action.options, "enabled") === true;
    await updateGuildToggle(env, interaction.guild_id, "lineup_enabled", enabled);
    return {
      content: `開始前スタメン通知を${enabled ? "有効" : "無効"}にしました。`,
      allowed_mentions: { parse: [] },
    };
  }

  throw new Error(`Unsupported setup action: ${action.name}`);
}

async function postScheduledWorldCupUpdates(env) {
  const settings = await allGuildSettings(env, { dailyEnabled: true });
  if (settings.length > 0) {
    const resultsPayloads = await buildResultsPayloads(todayInTokyo());
    const matchPayload = await buildDiscordPayloadForDate(tomorrowInTokyo());

    for (const setting of settings) {
      if (setting.results_channel_id) {
        for (const payload of resultsPayloads) {
          await postBotPayload(env, setting.results_channel_id, payload);
        }
      }
      if (setting.schedule_channel_id) {
        await postBotPayload(env, setting.schedule_channel_id, matchPayload);
      }
    }
    return;
  }

  const resultsPayloads = await buildResultsPayloads(todayInTokyo());
  for (const payload of resultsPayloads) {
    await postWebhookPayload(env.DISCORD_RESULTS_WEBHOOK_URL, payload);
  }

  const matchPayload = await buildDiscordPayloadForDate(tomorrowInTokyo());
  await postWebhookPayload(env.DISCORD_WEBHOOK_URL, matchPayload);
}

async function postLineupReminders(env) {
  const events = await upcomingLineupReminderEvents();
  console.log("Checking lineup reminders", { count: events.length });
  const settings = await allGuildSettings(env, { lineupEnabled: true });

  for (const event of events) {
    const payload = await buildLineupPayloadForEvent(event.id, { textOnly: true });
    if (payload.content?.includes("公式スタメンはまだ発表されていません")) {
      console.log("Skipping lineup reminder without official lineups", { eventId: event.id, title: event.title });
      continue;
    }

    const reminderPayload = {
      ...payload,
      content: ["## ⏰  まもなくキックオフ", payload.content].join("\n\n"),
    };

    if (settings.length > 0) {
      for (const setting of settings) {
        const channelId = setting.lineup_channel_id || setting.schedule_channel_id;
        if (!channelId) continue;
        const key = `lineup-posted:${setting.guild_id}:${event.id}`;
        if (env.LINEUP_POSTS && await env.LINEUP_POSTS.get(key)) {
          console.log("Skipping posted lineup reminder", { eventId: event.id, guildId: setting.guild_id, title: event.title });
          continue;
        }
        await postBotPayload(env, channelId, reminderPayload);
        if (env.LINEUP_POSTS) {
          await env.LINEUP_POSTS.put(key, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 14 });
        }
      }
      continue;
    }

    const webhookUrl = env.DISCORD_LINEUP_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("Lineup webhook URL is not configured");
    }

    const key = `lineup-posted:webhook:${event.id}`;
    if (env.LINEUP_POSTS && await env.LINEUP_POSTS.get(key)) {
      console.log("Skipping posted lineup reminder", { eventId: event.id, title: event.title });
      continue;
    }
    await postWebhookPayload(webhookUrl, reminderPayload);
    if (env.LINEUP_POSTS) {
      await env.LINEUP_POSTS.put(key, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 * 14 });
    }
  }
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

async function respondToWorldCupCommand(interaction, env) {
  try {
    const subcommand = interaction.data?.options?.[0];
    console.log("Handling /wc command", {
      id: interaction.id,
      subcommand: subcommand?.name ?? "today",
    });
    let payloads;

    if (!subcommand || ["today", "tomorrow", "date"].includes(subcommand.name)) {
      payloads = await buildDiscordPayloadForDate(targetDateFromCommand(interaction));
    } else if (subcommand.name === "team") {
      payloads = buildTeamPayloads(optionValue(subcommand.options, "team"), optionValue(subcommand.options, "position"));
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
    } else if (subcommand.name === "setup") {
      payloads = await buildSetupPayload(interaction, env);
    } else if (subcommand.name === "results") {
      payloads = await buildResultsPayloads(dateOptionOrToday(subcommand.options));
    } else if (subcommand.name === "standings") {
      const group = optionValue(subcommand.options, "group");
      payloads = group ? await buildGroupStandingsPayloads(group) : await buildStandingsPayloads();
    } else if (subcommand.name === "rankings") {
      payloads = await buildFifaRankingsPayloads(optionValue(subcommand.options, "group"), {
        english: optionValue(subcommand.options, "english") === true,
      });
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
  if (focused?.name === "position") {
    return jsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: positionChoices(focused.value) },
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
    const image = optionValue(subcommand.options, "image") === true;
    const legacyTextOnly = optionValue(subcommand.options, "text") === true;
    try {
      if (!image || legacyTextOnly) {
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

  ctx.waitUntil(respondToWorldCupCommand(interaction, env));
  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

export default {
  async scheduled(controller, env, ctx) {
    console.log("Received scheduled event", { cron: controller.cron });
    if (controller.cron === "0 7 * * *") {
      ctx.waitUntil(postScheduledWorldCupUpdates(env));
    } else if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(postLineupReminders(env));
    }
  },

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
