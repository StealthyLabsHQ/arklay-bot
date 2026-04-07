import db from './db';

export interface GiveawayRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  prize: string;
  host_id: string;
  winner_count: number;
  ends_at: string;
  ended: number;
  winners: string;
}

const stmtInsert = db.prepare(
  'INSERT INTO giveaways (guild_id, channel_id, prize, host_id, winner_count, ends_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const stmtSetMessageId = db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?');
const stmtGetByMsg     = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
const stmtGetById      = db.prepare('SELECT * FROM giveaways WHERE id = ?');
const stmtGetActive    = db.prepare('SELECT * FROM giveaways WHERE ended = 0');
const stmtEnd          = db.prepare('UPDATE giveaways SET ended = 1, winners = ? WHERE id = ?');

export function createGiveaway(
  guildId: string, channelId: string, prize: string,
  hostId: string, winnerCount: number, endsAt: Date
): number {
  const result = stmtInsert.run(guildId, channelId, prize, hostId, winnerCount, endsAt.toISOString());
  return result.lastInsertRowid as number;
}

export function setMessageId(id: number, messageId: string): void {
  stmtSetMessageId.run(messageId, id);
}

export function getGiveawayByMessageId(messageId: string): GiveawayRow | undefined {
  return stmtGetByMsg.get(messageId) as GiveawayRow | undefined;
}

export function getGiveawayById(id: number): GiveawayRow | undefined {
  return stmtGetById.get(id) as GiveawayRow | undefined;
}

export function getActiveGiveaways(): GiveawayRow[] {
  return stmtGetActive.all() as GiveawayRow[];
}

export function endGiveaway(id: number, winners: string[]): void {
  stmtEnd.run(JSON.stringify(winners), id);
}

export function parseDuration(input: string): number | null {
  const match = /^(\d+)(m|h|d)$/.exec(input.trim().toLowerCase());
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!;
  if (unit === 'm') return n * 60_000;
  if (unit === 'h') return n * 3_600_000;
  if (unit === 'd') return n * 86_400_000;
  return null;
}
