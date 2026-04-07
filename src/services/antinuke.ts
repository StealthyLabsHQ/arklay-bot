import type { Client, Guild, GuildMember } from 'discord.js';
import { AuditLogEvent } from 'discord.js';
import db from './db';
import { logger } from './logger';

export interface AntiNukeConfig {
  enabled: boolean;
  ban_threshold: number;
  kick_threshold: number;
  channel_threshold: number;
  role_threshold: number;
  window_seconds: number;
  action: 'strip' | 'kick' | 'ban';
  whitelist: string[];
}

// ── DB statements ─────────────────────────────────────────────────────────────
const stmtGet = db.prepare('SELECT * FROM antinuke_config WHERE guild_id = ?');
const stmtUpsert = db.prepare(`
  INSERT INTO antinuke_config (guild_id, enabled, ban_threshold, kick_threshold, channel_threshold, role_threshold, window_seconds, action, whitelist)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    enabled = excluded.enabled,
    ban_threshold = excluded.ban_threshold,
    kick_threshold = excluded.kick_threshold,
    channel_threshold = excluded.channel_threshold,
    role_threshold = excluded.role_threshold,
    window_seconds = excluded.window_seconds,
    action = excluded.action,
    whitelist = excluded.whitelist
`);
const stmtLog = db.prepare(
  'INSERT INTO antinuke_logs (guild_id, trigger_type, actor_id, action_taken, timestamp) VALUES (?, ?, ?, ?, ?)'
);
const stmtGetLogs = db.prepare(
  'SELECT * FROM antinuke_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 20'
);

export function getConfig(guildId: string): AntiNukeConfig {
  const row = stmtGet.get(guildId) as Record<string, unknown> | undefined;
  if (!row) return {
    enabled: false,
    ban_threshold: 3,
    kick_threshold: 3,
    channel_threshold: 2,
    role_threshold: 2,
    window_seconds: 10,
    action: 'strip',
    whitelist: [],
  };
  return {
    enabled: Boolean(row['enabled']),
    ban_threshold: row['ban_threshold'] as number,
    kick_threshold: row['kick_threshold'] as number,
    channel_threshold: row['channel_threshold'] as number,
    role_threshold: row['role_threshold'] as number,
    window_seconds: row['window_seconds'] as number,
    action: row['action'] as 'strip' | 'kick' | 'ban',
    whitelist: JSON.parse(row['whitelist'] as string) as string[],
  };
}

export function saveConfig(guildId: string, cfg: AntiNukeConfig): void {
  stmtUpsert.run(
    guildId,
    cfg.enabled ? 1 : 0,
    cfg.ban_threshold,
    cfg.kick_threshold,
    cfg.channel_threshold,
    cfg.role_threshold,
    cfg.window_seconds,
    cfg.action,
    JSON.stringify(cfg.whitelist),
  );
}

export interface AntiNukeLog {
  id: number;
  guild_id: string;
  trigger_type: string;
  actor_id: string;
  action_taken: string;
  timestamp: number;
}

export function getLogs(guildId: string): AntiNukeLog[] {
  return stmtGetLogs.all(guildId) as AntiNukeLog[];
}

// ── In-memory action tracker ───────────────────────────────────────────────────
type ActionType = 'ban' | 'kick' | 'channel_delete' | 'role_delete';

const tracker = new Map<string, Map<string, number[]>>(); // guildId → actorId → timestamps[]

function track(guildId: string, actorId: string, type: ActionType): number {
  const key = `${guildId}:${type}`;
  if (!tracker.has(key)) tracker.set(key, new Map());
  const map = tracker.get(key)!;
  const now = Date.now();
  const cfg = getConfig(guildId);
  const window = cfg.window_seconds * 1000;

  const times = (map.get(actorId) ?? []).filter((t) => now - t < window);
  times.push(now);
  map.set(actorId, times);
  return times.length;
}

async function punish(guild: Guild, actorId: string, triggerType: string, cfg: AntiNukeConfig): Promise<void> {
  let actionTaken = 'none';
  try {
    const member = await guild.members.fetch(actorId).catch(() => null);
    if (!member) return;

    if (cfg.action === 'strip') {
      const roles = member.roles.cache.filter((r) => r.id !== guild.id && r.editable);
      await member.roles.remove(roles, 'AntiNuke: suspicious activity');
      actionTaken = 'strip_roles';
    } else if (cfg.action === 'kick') {
      if (member.kickable) { await member.kick('AntiNuke: suspicious activity'); actionTaken = 'kick'; }
    } else if (cfg.action === 'ban') {
      if (member.bannable) { await guild.members.ban(actorId, { reason: 'AntiNuke: suspicious activity' }); actionTaken = 'ban'; }
    }

    stmtLog.run(guild.id, triggerType, actorId, actionTaken, Date.now());
    logger.warn('antinuke: %s on %s in guild %s — action: %s', triggerType, actorId, guild.id, actionTaken);

    // Alert in system channel if available
    const ch = guild.systemChannel;
    if (ch) {
      await ch.send(`**AntiNuke** — Suspicious activity detected from <@${actorId}> (\`${triggerType}\`). Action taken: \`${actionTaken}\`.`).catch(() => undefined);
    }
  } catch (err) {
    logger.error({ err }, 'antinuke punish failed');
  }
}

// ── Event listeners ────────────────────────────────────────────────────────────
export function registerAntiNuke(client: Client): void {
  // Mass ban detection
  client.on('guildBanAdd', async (ban) => {
    const cfg = getConfig(ban.guild.id);
    if (!cfg.enabled) return;

    const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
    const actorId = logs?.entries.first()?.executor?.id;
    if (!actorId || actorId === client.user?.id) return;
    if (cfg.whitelist.includes(actorId)) return;

    const count = track(ban.guild.id, actorId, 'ban');
    if (count >= cfg.ban_threshold) await punish(ban.guild, actorId, 'mass_ban', cfg);
  });

  // Mass kick detection
  client.on('guildMemberRemove', async (member) => {
    const cfg = getConfig(member.guild.id);
    if (!cfg.enabled) return;

    const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
    const entry = logs?.entries.first();
    if (!entry || entry.target?.id !== member.id) return;
    const actorId = entry.executor?.id;
    if (!actorId || actorId === client.user?.id) return;
    if (cfg.whitelist.includes(actorId)) return;

    const count = track(member.guild.id, actorId, 'kick');
    if (count >= cfg.kick_threshold) await punish(member.guild, actorId, 'mass_kick', cfg);
  });

  // Mass channel delete detection
  client.on('channelDelete', async (channel) => {
    if (!('guild' in channel) || !channel.guild) return;
    const cfg = getConfig(channel.guild.id);
    if (!cfg.enabled) return;

    const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 }).catch(() => null);
    const actorId = logs?.entries.first()?.executor?.id;
    if (!actorId || actorId === client.user?.id) return;
    if (cfg.whitelist.includes(actorId)) return;

    const count = track(channel.guild.id, actorId, 'channel_delete');
    if (count >= cfg.channel_threshold) await punish(channel.guild, actorId, 'mass_channel_delete', cfg);
  });

  // Mass role delete detection
  client.on('roleDelete', async (role) => {
    const cfg = getConfig(role.guild.id);
    if (!cfg.enabled) return;

    const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 }).catch(() => null);
    const actorId = logs?.entries.first()?.executor?.id;
    if (!actorId || actorId === client.user?.id) return;
    if (cfg.whitelist.includes(actorId)) return;

    const count = track(role.guild.id, actorId, 'role_delete');
    if (count >= cfg.role_threshold) await punish(role.guild, actorId, 'mass_role_delete', cfg);
  });

  logger.info('antinuke: event listeners registered');
}
