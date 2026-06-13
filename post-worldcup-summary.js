import { buildResultsPayloads } from "./src/results.js";
import { todayInTokyo } from "./src/schedule.js";

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

  return todayInTokyo();
}

async function postPayload(discordWebhookUrl, payload) {
  const discordRes = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!discordRes.ok) {
    const body = await discordRes.text();
    throw new Error(`Discord webhook error: ${discordRes.status} ${body}`);
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const discordWebhookUrl = dryRun ? null : getRequiredEnv("DISCORD_RESULTS_WEBHOOK_URL");
  const payloads = await buildResultsPayloads(targetDateInTokyo());

  if (dryRun) {
    for (const payload of payloads) {
      console.log(payload.content);
      console.log("\n---\n");
    }
    return;
  }

  for (const payload of payloads) {
    await postPayload(discordWebhookUrl, payload);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
