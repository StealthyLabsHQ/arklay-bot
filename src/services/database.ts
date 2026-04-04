// Conversation history - SQLite persistent per (guildId, userId)
// Max 10 exchanges (20 messages) per user per guild, FIFO
import db from './db';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const stmtGet = db.prepare(
  'SELECT role, content FROM conversation_history WHERE guild_id = ? AND user_id = ? ORDER BY id ASC'
);
const stmtInsert = db.prepare(
  'INSERT INTO conversation_history (guild_id, user_id, role, content) VALUES (?, ?, ?, ?)'
);
const stmtTrim = db.prepare(`
  DELETE FROM conversation_history WHERE id NOT IN (
    SELECT id FROM conversation_history WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?
  ) AND guild_id = ? AND user_id = ?
`);
const stmtClear = db.prepare(
  'DELETE FROM conversation_history WHERE guild_id = ? AND user_id = ?'
);

export function getHistory(guildId: string, userId: string): ConversationMessage[] {
  return stmtGet.all(guildId, userId) as ConversationMessage[];
}

export function saveMessage(
  guildId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  maxPairs = 10
): void {
  stmtInsert.run(guildId, userId, role, content);
  stmtTrim.run(guildId, userId, maxPairs * 2, guildId, userId);
}

export function clearHistory(guildId: string, userId: string): void {
  stmtClear.run(guildId, userId);
}
