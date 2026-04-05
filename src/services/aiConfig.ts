// Per-user AI model configuration - SQLite persistent
import db from './db';

export type AIProvider = 'claude' | 'gemini';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
}

// Available models per provider
export const MODELS: Record<AIProvider, { id: string; label: string; displayName: string }[]> = {
  claude: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)', displayName: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6',   label: 'Claude Opus 4.6 (most powerful)', displayName: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (fastest)',      displayName: 'Claude Haiku 4.5' },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview',        label: 'Gemini 3 Flash Preview (recommended)', displayName: 'Gemini 3 Flash Preview' },
    { id: 'gemini-3.1-pro-preview',        label: 'Gemini 3.1 Pro Preview (most powerful)', displayName: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (cheapest)',     displayName: 'Gemini 3.1 Flash Lite' },
  ],
};

const DEFAULT_CONFIG: Readonly<AIModelConfig> = {
  provider: 'gemini',
  model: 'gemini-3.1-flash-lite-preview',
};

const stmtGet = db.prepare('SELECT provider, model FROM ai_config WHERE user_id = ?');
const stmtSet = db.prepare(
  'INSERT INTO ai_config (user_id, provider, model) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET provider = excluded.provider, model = excluded.model'
);
const stmtDel = db.prepare('DELETE FROM ai_config WHERE user_id = ?');

export function getAIConfig(userId?: string): Readonly<AIModelConfig> {
  if (userId) {
    const row = stmtGet.get(userId) as { provider: AIProvider; model: string } | undefined;
    if (row) return row;
  }
  return DEFAULT_CONFIG;
}

export function setAIConfig(provider: AIProvider, model: string, userId?: string): void {
  if (userId) {
    stmtSet.run(userId, provider, model);
  }
}

export function resetAIConfig(userId: string): void {
  stmtDel.run(userId);
}

/**
 * Returns the display name and API source label for the current model.
 */
export function getModelDisplayInfo(
  provider: AIProvider,
  modelId: string,
  vertexMode = false
): { name: string; source: string } {
  const list = MODELS[provider];
  const found = list.find((m) => m.id === modelId);
  const name = found?.displayName ?? modelId;

  let source: string;
  if (provider === 'gemini') {
    source = 'Google Gemini API';
  } else if (vertexMode) {
    source = 'Google Cloud Vertex AI';
  } else {
    source = 'Anthropic Claude API';
  }

  return { name, source };
}
