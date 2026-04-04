// Per-guild warning system - SQLite persistent
import db from './db';

export interface Warning {
  reason: string;
  moderatorId: string;
  timestamp: number;
}

const stmtAdd = db.prepare(
  'INSERT INTO warnings (guild_id, user_id, reason, moderator_id, timestamp) VALUES (?, ?, ?, ?, ?)'
);
const stmtGet = db.prepare(
  'SELECT reason, moderator_id AS moderatorId, timestamp FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp ASC'
);
const stmtCount = db.prepare(
  'SELECT COUNT(*) AS cnt FROM warnings WHERE guild_id = ? AND user_id = ?'
);
const stmtClear = db.prepare(
  'DELETE FROM warnings WHERE guild_id = ? AND user_id = ?'
);

export function addWarning(guildId: string, userId: string, reason: string, moderatorId: string): Warning[] {
  stmtAdd.run(guildId, userId, reason, moderatorId, Date.now());
  return stmtGet.all(guildId, userId) as Warning[];
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return stmtGet.all(guildId, userId) as Warning[];
}

export function clearWarnings(guildId: string, userId: string): number {
  const count = (stmtCount.get(guildId, userId) as { cnt: number }).cnt;
  stmtClear.run(guildId, userId);
  return count;
}
