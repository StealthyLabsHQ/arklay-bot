// Per-guild configuration - SQLite persistent
import db from './db';

export interface WelcomeConfig {
  channelId: string;
  message: string;
}

// Ensure row exists for a guild (upsert helper)
const stmtEnsure = db.prepare(
  'INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)'
);

// ── Autorole ──
const stmtGetAutorole = db.prepare('SELECT autorole_id FROM guild_config WHERE guild_id = ?');
const stmtSetAutorole = db.prepare(
  'INSERT INTO guild_config (guild_id, autorole_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET autorole_id = excluded.autorole_id'
);
const stmtRemoveAutorole = db.prepare('UPDATE guild_config SET autorole_id = NULL WHERE guild_id = ?');

export function getAutorole(guildId: string): string | null {
  const row = stmtGetAutorole.get(guildId) as { autorole_id: string | null } | undefined;
  return row?.autorole_id ?? null;
}
export function setAutorole(guildId: string, roleId: string): void {
  stmtSetAutorole.run(guildId, roleId);
}
export function removeAutorole(guildId: string): boolean {
  return stmtRemoveAutorole.run(guildId).changes > 0;
}

// ── Welcome ──
const stmtGetWelcome = db.prepare('SELECT welcome_channel_id, welcome_message FROM guild_config WHERE guild_id = ?');
const stmtSetWelcome = db.prepare(
  'INSERT INTO guild_config (guild_id, welcome_channel_id, welcome_message) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET welcome_channel_id = excluded.welcome_channel_id, welcome_message = excluded.welcome_message'
);
const stmtRemoveWelcome = db.prepare('UPDATE guild_config SET welcome_channel_id = NULL, welcome_message = NULL WHERE guild_id = ?');

export function getWelcome(guildId: string): WelcomeConfig | null {
  const row = stmtGetWelcome.get(guildId) as { welcome_channel_id: string | null; welcome_message: string | null } | undefined;
  if (!row?.welcome_channel_id || !row?.welcome_message) return null;
  return { channelId: row.welcome_channel_id, message: row.welcome_message };
}
export function setWelcome(guildId: string, channelId: string, message: string): void {
  stmtSetWelcome.run(guildId, channelId, message);
}
export function removeWelcome(guildId: string): boolean {
  return stmtRemoveWelcome.run(guildId).changes > 0;
}

// ── Logs ──
const stmtGetLog = db.prepare('SELECT log_channel_id FROM guild_config WHERE guild_id = ?');
const stmtSetLog = db.prepare(
  'INSERT INTO guild_config (guild_id, log_channel_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = excluded.log_channel_id'
);
const stmtRemoveLog = db.prepare('UPDATE guild_config SET log_channel_id = NULL WHERE guild_id = ?');

export function getLogChannel(guildId: string): string | null {
  const row = stmtGetLog.get(guildId) as { log_channel_id: string | null } | undefined;
  return row?.log_channel_id ?? null;
}
export function setLogChannel(guildId: string, channelId: string): void {
  stmtSetLog.run(guildId, channelId);
}
export function removeLogChannel(guildId: string): boolean {
  return stmtRemoveLog.run(guildId).changes > 0;
}

// ── Automod ──
const stmtGetAutomod = db.prepare('SELECT automod_enabled FROM guild_config WHERE guild_id = ?');
const stmtSetAutomod = db.prepare(
  'INSERT INTO guild_config (guild_id, automod_enabled) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET automod_enabled = excluded.automod_enabled'
);

export function isAutomodEnabled(guildId: string): boolean {
  const row = stmtGetAutomod.get(guildId) as { automod_enabled: number } | undefined;
  return row?.automod_enabled === 1;
}
export function setAutomodEnabled(guildId: string, enabled: boolean): void {
  stmtSetAutomod.run(guildId, enabled ? 1 : 0);
}

// ── Temp VC Hub ──
const stmtGetTempVc = db.prepare('SELECT temp_vc_hub_id FROM guild_config WHERE guild_id = ?');
const stmtSetTempVc = db.prepare(
  'INSERT INTO guild_config (guild_id, temp_vc_hub_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET temp_vc_hub_id = excluded.temp_vc_hub_id'
);
const stmtRemoveTempVc = db.prepare('UPDATE guild_config SET temp_vc_hub_id = NULL WHERE guild_id = ?');

export function getTempVcHub(guildId: string): string | null {
  const row = stmtGetTempVc.get(guildId) as { temp_vc_hub_id: string | null } | undefined;
  return row?.temp_vc_hub_id ?? null;
}
export function setTempVcHub(guildId: string, channelId: string): void {
  stmtSetTempVc.run(guildId, channelId);
}
export function removeTempVcHub(guildId: string): boolean {
  return stmtRemoveTempVc.run(guildId).changes > 0;
}

// ── Language ──
const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  fr: 'Fran\u00e7ais',
  es: 'Espa\u00f1ol',
  de: 'Deutsch',
  pt: 'Portugu\u00eas',
  it: 'Italiano',
  nl: 'Nederlands',
  ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
  ja: '\u65e5\u672c\u8a9e',
  ko: '\ud55c\uad6d\uc5b4',
  zh: '\u4e2d\u6587',
  ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
  tr: 'T\u00fcrk\u00e7e',
};

const stmtGetLanguage = db.prepare('SELECT language FROM guild_config WHERE guild_id = ?');
const stmtSetLanguage = db.prepare(
  'INSERT INTO guild_config (guild_id, language) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET language = excluded.language'
);

export function getLanguage(guildId: string): string {
  const row = stmtGetLanguage.get(guildId) as { language: string } | undefined;
  return row?.language ?? 'en';
}
export function setLanguage(guildId: string, lang: string): void {
  stmtSetLanguage.run(guildId, lang);
}
export function getSupportedLanguages(): Record<string, string> {
  return SUPPORTED_LANGUAGES;
}
export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES[code] ?? code;
}
