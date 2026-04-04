// SQLite database singleton - persistent storage for bot state
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import { logger } from './logger';

const DATA_DIR = path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db: DatabaseType = new Database(path.join(DATA_DIR, 'bot.db'));

// Performance: WAL mode + foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema migrations ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    reason        TEXT NOT NULL,
    moderator_id  TEXT NOT NULL,
    timestamp     INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);

  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id            TEXT PRIMARY KEY,
    autorole_id         TEXT,
    welcome_channel_id  TEXT,
    welcome_message     TEXT,
    log_channel_id      TEXT,
    automod_enabled     INTEGER NOT NULL DEFAULT 0,
    temp_vc_hub_id      TEXT,
    language            TEXT NOT NULL DEFAULT 'en'
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    user_id   TEXT PRIMARY KEY,
    provider  TEXT NOT NULL,
    model     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS image_config (
    user_id             TEXT PRIMARY KEY,
    temperature         REAL NOT NULL DEFAULT 1,
    default_ratio       TEXT NOT NULL DEFAULT '1:1',
    default_resolution  TEXT NOT NULL DEFAULT '1k',
    system_instructions TEXT NOT NULL DEFAULT '',
    output_format       TEXT NOT NULL DEFAULT 'images_text'
  );

  CREATE TABLE IF NOT EXISTS conversation_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_convo_guild_user ON conversation_history(guild_id, user_id);

  CREATE TABLE IF NOT EXISTS usage_limits (
    user_id  TEXT NOT NULL,
    model    TEXT NOT NULL,
    date     TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, model, date)
  );

  CREATE TABLE IF NOT EXISTS bot_admin_roles (
    guild_id  TEXT NOT NULL,
    role_id   TEXT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS music_resume (
    guild_id          TEXT PRIMARY KEY,
    voice_channel_id  TEXT NOT NULL,
    text_channel_id   TEXT NOT NULL,
    tracks_json       TEXT NOT NULL,
    volume            INTEGER NOT NULL DEFAULT 50,
    loop_mode         TEXT NOT NULL DEFAULT 'off',
    filter            TEXT NOT NULL DEFAULT 'none'
  );
`);

// ── Migrations for existing databases ────────────────────────────────────────
const columns = db.prepare("PRAGMA table_info(guild_config)").all() as Array<{ name: string }>;
const colNames = new Set(columns.map((c) => c.name));
if (!colNames.has('language')) {
  db.exec("ALTER TABLE guild_config ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  logger.info('db: migrated guild_config — added language column');
}

logger.info('db: SQLite initialized (data/bot.db)');

export default db;
