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

  CREATE TABLE IF NOT EXISTS localai_config (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS localai_knowledge (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    topic      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_favorites (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL,
    title     TEXT NOT NULL,
    url       TEXT NOT NULL,
    duration  TEXT NOT NULL DEFAULT '??:??',
    source    TEXT NOT NULL DEFAULT 'unknown',
    saved_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

  CREATE TABLE IF NOT EXISTS user_playlists (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL,
    name      TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_playlists_user ON user_playlists(user_id);

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    duration    TEXT NOT NULL DEFAULT '??:??',
    source      TEXT NOT NULL DEFAULT 'unknown',
    position    INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id);

  CREATE TABLE IF NOT EXISTS user_persona (
    user_id  TEXT PRIMARY KEY,
    persona  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS music_plays (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT,
    played_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_music_plays_guild ON music_plays(guild_id);

  CREATE TABLE IF NOT EXISTS music_resume (
    guild_id          TEXT PRIMARY KEY,
    voice_channel_id  TEXT NOT NULL,
    text_channel_id   TEXT NOT NULL,
    tracks_json       TEXT NOT NULL,
    volume            INTEGER NOT NULL DEFAULT 50,
    loop_mode         TEXT NOT NULL DEFAULT 'off',
    filter            TEXT NOT NULL DEFAULT 'none'
  );

  CREATE TABLE IF NOT EXISTS guild_tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    content    TEXT NOT NULL,
    author_id  TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    uses       INTEGER DEFAULT 0,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT NOT NULL,
    message_id   TEXT,
    prize        TEXT NOT NULL,
    host_id      TEXT NOT NULL,
    winner_count INTEGER DEFAULT 1,
    ends_at      TEXT NOT NULL,
    ended        INTEGER DEFAULT 0,
    winners      TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS mod_cases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action       TEXT NOT NULL,
    reason       TEXT NOT NULL,
    extra        TEXT,
    timestamp    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mod_cases_guild_user ON mod_cases(guild_id, user_id);

  CREATE TABLE IF NOT EXISTS antinuke_config (
    guild_id          TEXT PRIMARY KEY,
    enabled           INTEGER NOT NULL DEFAULT 0,
    ban_threshold     INTEGER NOT NULL DEFAULT 3,
    kick_threshold    INTEGER NOT NULL DEFAULT 3,
    channel_threshold INTEGER NOT NULL DEFAULT 2,
    role_threshold    INTEGER NOT NULL DEFAULT 2,
    window_seconds    INTEGER NOT NULL DEFAULT 10,
    action            TEXT NOT NULL DEFAULT 'strip',
    whitelist         TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS antinuke_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    actor_id     TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    timestamp    INTEGER NOT NULL
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
