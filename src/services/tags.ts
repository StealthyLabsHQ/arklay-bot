import db from './db';

export interface Tag {
  id: number;
  guild_id: string;
  name: string;
  content: string;
  author_id: string;
  created_at: string;
  uses: number;
}

const stmtCreate   = db.prepare('INSERT INTO guild_tags (guild_id, name, content, author_id) VALUES (?, ?, ?, ?)');
const stmtGet      = db.prepare('SELECT * FROM guild_tags WHERE guild_id = ? AND name = ?');
const stmtList     = db.prepare('SELECT * FROM guild_tags WHERE guild_id = ? ORDER BY uses DESC');
const stmtDelete   = db.prepare('DELETE FROM guild_tags WHERE guild_id = ? AND name = ?');
const stmtEdit     = db.prepare('UPDATE guild_tags SET content = ? WHERE guild_id = ? AND name = ?');
const stmtIncUses  = db.prepare('UPDATE guild_tags SET uses = uses + 1 WHERE guild_id = ? AND name = ?');
const stmtSearch   = db.prepare("SELECT name FROM guild_tags WHERE guild_id = ? AND name LIKE ? LIMIT 25");

export function createTag(guildId: string, name: string, content: string, authorId: string): boolean {
  try {
    stmtCreate.run(guildId, name, content, authorId);
    return true;
  } catch {
    return false; // UNIQUE constraint
  }
}

export function getTag(guildId: string, name: string): Tag | undefined {
  return stmtGet.get(guildId, name) as Tag | undefined;
}

export function listTags(guildId: string): Tag[] {
  return stmtList.all(guildId) as Tag[];
}

export function deleteTag(guildId: string, name: string): boolean {
  return stmtDelete.run(guildId, name).changes > 0;
}

export function editTag(guildId: string, name: string, newContent: string): boolean {
  return stmtEdit.run(newContent, guildId, name).changes > 0;
}

export function incrementUses(guildId: string, name: string): void {
  stmtIncUses.run(guildId, name);
}

export function searchTags(guildId: string, query: string): { name: string }[] {
  return stmtSearch.all(guildId, `${query}%`) as { name: string }[];
}
