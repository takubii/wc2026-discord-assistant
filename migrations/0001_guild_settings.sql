CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  schedule_channel_id TEXT,
  results_channel_id TEXT,
  lineup_channel_id TEXT,
  daily_enabled INTEGER NOT NULL DEFAULT 1,
  lineup_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
