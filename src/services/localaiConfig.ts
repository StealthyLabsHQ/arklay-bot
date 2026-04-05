import db from './db';

// ── System Prompt ────────────────────────────────────────────────────────────

const stmtGetConfig = db.prepare('SELECT value FROM localai_config WHERE key = ?');
const stmtSetConfig = db.prepare(
  'INSERT INTO localai_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
const stmtDelConfig = db.prepare('DELETE FROM localai_config WHERE key = ?');

export function getSystemPrompt(): string | null {
  const row = stmtGetConfig.get('system_prompt') as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSystemPrompt(prompt: string): void {
  stmtSetConfig.run('system_prompt', prompt);
}

export function isThinkingEnabled(): boolean {
  const row = stmtGetConfig.get('thinking') as { value: string } | undefined;
  return row?.value === 'true';
}

export function setThinking(enabled: boolean): void {
  stmtSetConfig.run('thinking', enabled ? 'true' : 'false');
}

export function resetSystemPrompt(): void {
  stmtDelConfig.run('system_prompt');
}

// ── Knowledge Base (RAG) ─────────────────────────────────────────────────────

const stmtAddKnowledge = db.prepare(
  'INSERT INTO localai_knowledge (topic, content) VALUES (?, ?)'
);
const stmtListKnowledge = db.prepare(
  'SELECT id, topic, content FROM localai_knowledge ORDER BY id'
);
const stmtGetKnowledge = db.prepare(
  'SELECT id, topic, content FROM localai_knowledge WHERE id = ?'
);
const stmtDelKnowledge = db.prepare('DELETE FROM localai_knowledge WHERE id = ?');
const stmtClearKnowledge = db.prepare('DELETE FROM localai_knowledge');
const stmtSearchKnowledge = db.prepare(
  'SELECT topic, content FROM localai_knowledge WHERE topic LIKE ? OR content LIKE ?'
);

export interface KnowledgeEntry {
  id: number;
  topic: string;
  content: string;
}

export function addKnowledge(topic: string, content: string): number {
  const result = stmtAddKnowledge.run(topic, content);
  return Number(result.lastInsertRowid);
}

export function listKnowledge(): KnowledgeEntry[] {
  return stmtListKnowledge.all() as KnowledgeEntry[];
}

export function getKnowledge(id: number): KnowledgeEntry | null {
  return (stmtGetKnowledge.get(id) as KnowledgeEntry) ?? null;
}

export function removeKnowledge(id: number): boolean {
  return stmtDelKnowledge.run(id).changes > 0;
}

export function clearKnowledge(): number {
  return stmtClearKnowledge.run().changes;
}

/** Search knowledge entries matching a query (simple keyword match). */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const pattern = `%${query}%`;
  return stmtSearchKnowledge.all(pattern, pattern) as KnowledgeEntry[];
}

/**
 * Build a context string from relevant knowledge entries for injection into the AI prompt.
 * Searches for keywords from the user prompt in the knowledge base.
 */
export function buildKnowledgeContext(userPrompt: string): string {
  // Extract significant words (>3 chars) from the prompt
  const words = userPrompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5); // max 5 keywords

  if (words.length === 0) return '';

  const seen = new Set<number>();
  const entries: KnowledgeEntry[] = [];

  for (const word of words) {
    const results = searchKnowledge(word);
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        entries.push(r);
      }
    }
  }

  if (entries.length === 0) return '';

  // Limit context to prevent token overflow
  const maxEntries = 5;
  const selected = entries.slice(0, maxEntries);

  return [
    '<knowledge_base>',
    ...selected.map((e) => `[${e.topic}]: ${e.content}`),
    '</knowledge_base>',
  ].join('\n');
}
