// Daily + weekly request limits per user per model - SQLite persistent
import db from './db';
import { config, isBotOwner } from './config';

interface Limits {
  daily: number;
  weekly: number;
}

const MODEL_LIMITS: Record<string, Limits> = {
  // Claude
  'claude-opus-4-6':               { daily: 3,   weekly: 15 },
  'claude-sonnet-4-6':             { daily: 20,  weekly: 100 },
  'claude-haiku-4-5':              { daily: 50,  weekly: 250 },
  // Gemini
  'gemini-3-flash-preview':        { daily: 50,  weekly: 250 },
  'gemini-3.1-pro-preview':        { daily: 10,  weekly: 50 },
  'gemini-3.1-flash-lite-preview': { daily: 150, weekly: 750 },
  // OpenAI — general
  'gpt-5.4-nano':                  { daily: 200, weekly: 1000 },
  'gpt-5.4-mini':                  { daily: 50,  weekly: 250 },
  'o4-mini':                       { daily: 15,  weekly: 75 },
  // OpenAI — code-specific (more restrictive)
  'gpt-5.3-codex':                 { daily: 20,  weekly: 100 },
  'gpt-5.4':                       { daily: 15,  weekly: 75 },
  'gpt-5.4-long-context':          { daily: 5,   weekly: 25 },
  // /imagine - per resolution
  'gemini-image-512':              { daily: 15,  weekly: 75 },
  'gemini-image-1k':               { daily: 10,  weekly: 50 },
  'gemini-image-2k':               { daily: 6,   weekly: 30 },
  'gemini-image-4k':               { daily: 3,   weekly: 15 },
};

function dateKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function weekKey(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10); // Monday of current week
}

const stmtGet = db.prepare(
  'SELECT count FROM usage_limits WHERE user_id = ? AND model = ? AND date = ?'
);
const stmtUpsert = db.prepare(`
  INSERT INTO usage_limits (user_id, model, date, count) VALUES (?, ?, ?, 1)
  ON CONFLICT(user_id, model, date) DO UPDATE SET count = count + 1
`);
const stmtWeekSum = db.prepare(
  'SELECT COALESCE(SUM(count), 0) as total FROM usage_limits WHERE user_id = ? AND model = ? AND date >= ?'
);

const OWNER_MULTIPLIER = config.BOT_OWNER_MULTIPLIER;

/**
 * Returns the hard daily limit for a model, or null if no limit applies.
 * Bot owner gets multiplied limits.
 */
export function getDailyLimit(model: string, userId?: string): number | null {
  const limits = MODEL_LIMITS[model];
  if (!limits) return null;
  if (userId && isBotOwner(userId)) return limits.daily * OWNER_MULTIPLIER;
  return limits.daily;
}

/**
 * Returns the weekly limit for a model, or null if no limit applies.
 */
export function getWeeklyLimit(model: string, userId?: string): number | null {
  const limits = MODEL_LIMITS[model];
  if (!limits) return null;
  if (userId && isBotOwner(userId)) return limits.weekly * OWNER_MULTIPLIER;
  return limits.weekly;
}

/**
 * Returns how many requests the user has made today for this model.
 */
export function getUsage(userId: string, model: string): number {
  const row = stmtGet.get(userId, model, dateKey()) as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Returns how many requests the user has made this week for this model.
 */
export function getWeeklyUsage(userId: string, model: string): number {
  const row = stmtWeekSum.get(userId, model, weekKey()) as { total: number };
  return row.total;
}

/**
 * Returns true if the user has hit the daily OR weekly limit for this model.
 */
export function isLimitReached(userId: string, model: string): boolean {
  const dailyLimit = getDailyLimit(model, userId);
  if (dailyLimit !== null && getUsage(userId, model) >= dailyLimit) return true;
  const weeklyLimit = getWeeklyLimit(model, userId);
  if (weeklyLimit !== null && getWeeklyUsage(userId, model) >= weeklyLimit) return true;
  return false;
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
  const dailyLimit = getDailyLimit(model, userId);
  if (dailyLimit === null) return null;
  const dailyLeft = Math.max(0, dailyLimit - getUsage(userId, model));

  const weeklyLimit = getWeeklyLimit(model, userId);
  if (weeklyLimit === null) return dailyLeft;
  const weeklyLeft = Math.max(0, weeklyLimit - getWeeklyUsage(userId, model));

  return Math.min(dailyLeft, weeklyLeft);
}

/**
 * Returns a human-readable limit status string.
 */
export function limitStatus(userId: string, model: string): string | null {
  const dailyLimit = getDailyLimit(model, userId);
  const weeklyLimit = getWeeklyLimit(model, userId);
  if (dailyLimit === null) return null;

  const dUsed = getUsage(userId, model);
  const parts = [`${dUsed}/${dailyLimit} today`];

  if (weeklyLimit !== null) {
    const wUsed = getWeeklyUsage(userId, model);
    parts.push(`${wUsed}/${weeklyLimit} this week`);
  }

  return parts.join(' \u2022 ');
}
