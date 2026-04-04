// Per-guild bot admin roles - SQLite persistent
// Users with Discord's Administrator permission always have full access
import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import db from './db';

const stmtGet = db.prepare('SELECT role_id FROM bot_admin_roles WHERE guild_id = ?');
const stmtAdd = db.prepare(
  'INSERT OR IGNORE INTO bot_admin_roles (guild_id, role_id) VALUES (?, ?)'
);
const stmtRemove = db.prepare(
  'DELETE FROM bot_admin_roles WHERE guild_id = ? AND role_id = ?'
);
const stmtList = db.prepare('SELECT role_id FROM bot_admin_roles WHERE guild_id = ?');

export function isBotAdmin(member: GuildMember): boolean {
  // Discord Administrator always has full access
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const rows = stmtGet.all(member.guild.id) as { role_id: string }[];
  if (rows.length === 0) return false;

  const roleIds = new Set(rows.map((r) => r.role_id));
  return member.roles.cache.some((r) => roleIds.has(r.id));
}

export function addBotAdminRole(guildId: string, roleId: string): void {
  stmtAdd.run(guildId, roleId);
}

export function removeBotAdminRole(guildId: string, roleId: string): boolean {
  return stmtRemove.run(guildId, roleId).changes > 0;
}

export function getBotAdminRoles(guildId: string): string[] {
  const rows = stmtList.all(guildId) as { role_id: string }[];
  return rows.map((r) => r.role_id);
}
