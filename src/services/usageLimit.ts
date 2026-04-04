// Daily request limits per user per model - SQLite persistent, resets at midnight UTC
import db from './db';
import { config } from './config';

const DAILY_LIMITS: Record<string, number> = {
  // Claude
  'claude-opus-4-6':   3,
  'claude-sonnet-4-6': 20,
  'claude-haiku-4-5':  50,
  // Gemini
  'gemini-3-flash-preview':        50,
  'gemini-3.1-pro-preview':        10,
  'gemini-3.1-flash-lite-preview': 150,
  // /imagine - per resolution
  'gemini-image-512': 15,
  'gemini-image-1k':  10,
  'gemini-image-2k':   6,
  'gemini-image-4k':   3,
};

function dateKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const stmtGet = db.prepare(
  'SELECT count FROM usage_limits WHERE user_id = ? AND model = ? AND date = ?'
);
const stmtUpsert = db.prepare(`
  INSERT INTO usage_limits (user_id, model, date, count) VALUES (?, ?, ?, 1)
  ON CONFLICT(user_id, model, date) DO UPDATE SET count = count + 1
`);

const OWNER_MULTIPLIER = config.BOT_OWNER_MULTIPLIER;

function isBotOwner(userId: string): boolean {
  return !!config.BOT_OWNER_ID && userId === config.BOT_OWNER_ID;
}

/**
 * Returns the hard daily limit for a model, or null if no limit applies.
 * Bot owner gets 5x the normal limit.
 */
export function getDailyLimit(model: string, userId?: string): number | null {
  const base = DAILY_LIMITS[model] ?? null;
  if (base === null) return null;
  if (userId && isBotOwner(userId)) return base * OWNER_MULTIPLIER;
  return base;
}

/**
 * Returns how many requests the user has made today for this model.
 */
export function getUsage(userId: string, model: string): number {
  const row = stmtGet.get(userId, model, dateKey()) as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Returns true if the user has hit the daily limit for this model.
 */
export function isLimitReached(userId: string, model: string): boolean {
  const limit = getDailyLimit(model, userId);
  if (limit === null) return false;
  return getUsage(userId, model) >= limit;
}

/**
 * Increments the user's usage counter for this model.
 * Call this only after a successful AI response.
 */
export function incrementUsage(userId: string, model: string): void {
  stmtUpsert.run(userId, model, dateKey());
}

/**
 * Returns remaining requests today, or null if no limit.
 */
export function remaining(userId: string, model: string): number | null {
  const limit = getDailyLimit(model, userId);
  if (limit === null) return null;
  return Math.max(0, limit - getUsage(userId, model));
}
