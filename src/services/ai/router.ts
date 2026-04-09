// AI provider router — lazy imports: SDKs loaded only when first used
import {
  claudeAvailable, geminiAvailable, openaiAvailable, ollamaAvailable,
} from './availability';
import { getHistory, saveMessage } from '../database';
import { getAIConfig } from '../aiConfig';
import { isLimitReached, incrementUsage } from '../usageLimit';
import { isCloudAIEnabled } from '../localaiConfig';

// Re-export error types (lightweight, no SDK)
export { NetworkError, SafetyError, RateLimitError } from './anthropic';
export type { TokenUsage } from './anthropic';

export type Provider = 'claude' | 'gemini' | 'openai' | 'ollama' | 'auto';

export interface AskResult {
  text: string;
  provider: 'claude' | 'gemini' | 'openai' | 'ollama';
  model: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

export class DailyLimitError extends Error {
  constructor(public readonly model: string, public readonly limit: number) {
    super(`Daily limit reached for ${model}`);
  }
}

export class CloudAIDisabledError extends Error {
  constructor() { super('Cloud AI is currently disabled by the bot owner.'); }
}

export interface ModelOverride {
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
}

// ── Lazy provider loaders (SDK imported on first call only) ─────────────────

async function loadClaude() { return import('./anthropic'); }
async function loadGemini() { return import('./google'); }
async function loadOpenAI() { return import('./openai'); }
async function loadOllama() { return import('./ollama'); }
async function loadPersona() { return import('../../modules/ai/commands/persona'); }

// ── Default models per provider ─────────────────────────────────────────────

async function defaultModel(provider: string): Promise<string> {
  if (provider === 'claude') return 'claude-sonnet-4-6';
  if (provider === 'openai') return 'gpt-5.4-nano';
  if (provider === 'ollama') {
    const { getModel } = await loadOllama();
    return getModel();
  }
  return 'gemini-3.1-flash-lite-preview';
}

// ── General-context downgrade map ────────────────────────────────────────────
// Heavy models are automatically switched to their lightweight equivalent
// for non-code commands (/ask, /summarize, /translate, etc.)
// /code bypasses ask() entirely (direct SDK calls), so it keeps the heavy model.

const GENERAL_DOWNGRADE: Record<string, string> = {
  'claude-sonnet-4-6':      'claude-haiku-4-5',
  'claude-opus-4-6':        'claude-haiku-4-5',
  'gemini-3.1-pro-preview': 'gemini-3.1-flash-lite-preview',
};

// ── Main ask function ───────────────────────────────────────────────────────

export async function ask(
  guildId: string,
  userId: string,
  prompt: string,
  provider: Provider = 'auto',
  allowThinking = true,
  modelOverride?: ModelOverride,
  systemPromptOverride?: string,
): Promise<AskResult> {
  const resolved = modelOverride ? modelOverride.provider : resolveProvider(provider, userId);
  const cfg = getAIConfig(userId);
  const configuredModel = modelOverride?.model ?? (cfg.provider === resolved ? cfg.model : await defaultModel(resolved));
  // Apply downgrade for general context unless the user explicitly picked a model this request
  const actualModel = modelOverride ? configuredModel : (GENERAL_DOWNGRADE[configuredModel] ?? configuredModel);

  if (isLimitReached(userId, actualModel)) {
    const { getDailyLimit } = await import('../usageLimit');
    throw new DailyLimitError(actualModel, getDailyLimit(actualModel) ?? 0);
  }

  const history = getHistory(guildId, userId);

  // Inject persona if set
  const { getPersona } = await loadPersona();
  const personaPrompt = getPersona(userId);
  const finalPrompt = personaPrompt ? `[Persona: ${personaPrompt}]\n\n${prompt}` : prompt;

  if (resolved === 'claude') {
    const { askClaude } = await loadClaude();
    const result = await askClaude(history, finalPrompt, userId, systemPromptOverride);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', prompt);
    saveMessage(guildId, userId, 'assistant', result.text);
    return { text: result.text, provider: 'claude', model: actualModel, tokenUsage: result.usage };
  }

  if (resolved === 'openai') {
    const { askOpenAI } = await loadOpenAI();
    const result = await askOpenAI(history, finalPrompt, userId, systemPromptOverride);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', prompt);
    saveMessage(guildId, userId, 'assistant', result.text);
    return {
      text: result.text,
      provider: 'openai',
      model: actualModel,
      tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }

  if (resolved === 'ollama') {
    const { askOllama } = await loadOllama();
    const result = await askOllama(history, finalPrompt, actualModel, allowThinking);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', prompt);
    saveMessage(guildId, userId, 'assistant', result.text);
    return {
      text: result.text,
      provider: 'ollama',
      model: actualModel,
      tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }

  // Gemini (default)
  const { askGemini } = await loadGemini();
  const result = await askGemini(history, finalPrompt, userId, systemPromptOverride);
  incrementUsage(userId, actualModel);
  saveMessage(guildId, userId, 'user', prompt);
  saveMessage(guildId, userId, 'assistant', result.text);
  return {
    text: result.text,
    provider: 'gemini',
    model: actualModel,
    tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
  };
}

// ── Ask with image ──────────────────────────────────────────────────────────

export async function askWithImage(
  guildId: string,
  userId: string,
  prompt: string,
  imageBase64: string,
  imageMime: string,
  provider: Provider = 'auto',
  modelOverride?: ModelOverride,
): Promise<AskResult> {
  const resolved = modelOverride ? modelOverride.provider : resolveProvider(provider, userId);
  const cfg = getAIConfig(userId);
  const configuredModel = modelOverride?.model ?? (cfg.provider === resolved ? cfg.model : await defaultModel(resolved));
  const actualModel = modelOverride ? configuredModel : (GENERAL_DOWNGRADE[configuredModel] ?? configuredModel);

  if (isLimitReached(userId, actualModel)) {
    const { getDailyLimit } = await import('../usageLimit');
    throw new DailyLimitError(actualModel, getDailyLimit(actualModel) ?? 0);
  }

  // Ollama doesn't support images — fallback to a vision-capable provider
  const imageProvider = resolved === 'ollama'
    ? (claudeAvailable() ? 'claude' : openaiAvailable() ? 'openai' : geminiAvailable() ? 'gemini' : resolved)
    : resolved;

  if (imageProvider === 'claude') {
    const { askClaudeWithImage } = await loadClaude();
    const result = await askClaudeWithImage(prompt, imageBase64, imageMime, userId);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', `[image] ${prompt}`);
    saveMessage(guildId, userId, 'assistant', result.text);
    return { text: result.text, provider: 'claude', model: actualModel, tokenUsage: result.usage };
  }

  if (imageProvider === 'openai') {
    const { askOpenAIWithImage } = await loadOpenAI();
    const result = await askOpenAIWithImage(prompt, imageBase64, imageMime, userId);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', `[image] ${prompt}`);
    saveMessage(guildId, userId, 'assistant', result.text);
    return {
      text: result.text,
      provider: 'openai',
      model: actualModel,
      tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }

  if (imageProvider === 'gemini') {
    const { askGeminiWithImage } = await loadGemini();
    const result = await askGeminiWithImage(prompt, imageBase64, imageMime, userId);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', `[image] ${prompt}`);
    saveMessage(guildId, userId, 'assistant', result.text);
    return {
      text: result.text,
      provider: 'gemini',
      model: actualModel,
      tokenUsage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }

  // Fallback: text only
  return ask(guildId, userId, prompt, provider);
}

// ── Provider resolution (lightweight — no SDK imports) ──────────────────────

function resolveProvider(provider: Provider, userId?: string): 'claude' | 'gemini' | 'openai' | 'ollama' {
  const cloudEnabled = isCloudAIEnabled();

  if (provider === 'auto') {
    const configured = getAIConfig(userId).provider;
    if (configured === 'ollama' && ollamaAvailable()) return 'ollama';
    if (!cloudEnabled) {
      if (ollamaAvailable()) return 'ollama';
      throw new CloudAIDisabledError();
    }
    if (configured === 'openai' && openaiAvailable()) return 'openai';
    if (configured === 'gemini' && geminiAvailable()) return 'gemini';
    if (configured === 'claude' && claudeAvailable()) return 'claude';
    if (geminiAvailable()) return 'gemini';
    if (claudeAvailable()) return 'claude';
    if (openaiAvailable()) return 'openai';
    if (ollamaAvailable()) return 'ollama';
    throw new Error('No AI provider available');
  }
  if (provider === 'ollama') {
    if (!ollamaAvailable()) throw new Error('Ollama is not configured (set OLLAMA_HOST or OLLAMA_MODEL in .env)');
    return 'ollama';
  }
  if (!cloudEnabled) throw new CloudAIDisabledError();
  if (provider === 'claude') {
    if (!claudeAvailable()) throw new Error('Claude provider is not available (missing API key)');
    return 'claude';
  }
  if (provider === 'openai') {
    if (!openaiAvailable()) throw new Error('OpenAI provider is not available (missing API key)');
    return 'openai';
  }
  if (!geminiAvailable()) throw new Error('Gemini provider is not available (missing API key)');
  return 'gemini';
}
