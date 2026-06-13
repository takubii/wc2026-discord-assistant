import { buildDiscordPayloadForDate, tomorrowInTokyo } from "./src/schedule.js";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function targetDateInTokyo() {
  if (process.env.TARGET_DATE) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(process.env.TARGET_DATE)) {
      throw new Error("TARGET_DATE must be YYYY-MM-DD");
    }
    return process.env.TARGET_DATE;
  }

  return tomorrowInTokyo();
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const discordWebhookUrl = dryRun ? null : getRequiredEnv("DISCORD_WEBHOOK_URL");
  const payload = await buildDiscordPayloadForDate(targetDateInTokyo());
  const postPayload = {
    username: "WC2026 試合日程",
    ...payload,
  };

  if (dryRun) {
    console.log(postPayload.content);
    return;
  }

  const discordRes = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postPayload),
  });

  if (!discordRes.ok) {
    const body = await discordRes.text();
    throw new Error(`Discord webhook error: ${discordRes.status} ${body}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
