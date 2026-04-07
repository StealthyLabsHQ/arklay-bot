import db from './db';

export type ModAction = 'warn' | 'ban' | 'kick' | 'timeout' | 'unban';

export interface ModCase {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  action: ModAction;
  reason: string;
  extra: string | null;
  timestamp: number;
}

const stmtInsert = db.prepare(
  'INSERT INTO mod_cases (guild_id, user_id, moderator_id, action, reason, extra, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const stmtGetAll = db.prepare(
  'SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC'
);
const stmtGetOne = db.prepare(
  'SELECT * FROM mod_cases WHERE id = ? AND guild_id = ?'
);

export function logCase(
  guildId: string,
  userId: string,
  moderatorId: string,
  action: ModAction,
  reason: string,
  extra?: string,
): number {
  const result = stmtInsert.run(guildId, userId, moderatorId, action, reason, extra ?? null, Date.now());
  return result.lastInsertRowid as number;
}

export function getCases(guildId: string, userId: string): ModCase[] {
  return stmtGetAll.all(guildId, userId) as ModCase[];
}

export function getCase(guildId: string, caseId: number): ModCase | undefined {
  return stmtGetOne.get(caseId, guildId) as ModCase | undefined;
}
