import { askClaude, askClaudeWithImage, isAvailable as claudeAvailable } from './anthropic';
import { askGemini, askGeminiWithImage, isAvailable as geminiAvailable } from './google';
import { askOllama, isAvailable as ollamaAvailable, getModel as getOllamaModel } from './ollama';
import { getHistory, saveMessage } from '../database';
import { getAIConfig } from '../aiConfig';
import { isLimitReached, incrementUsage } from '../usageLimit';
export { NetworkError, SafetyError, RateLimitError } from './anthropic';
export type { TokenUsage } from './anthropic';

export type Provider = 'claude' | 'gemini' | 'ollama' | 'auto';

export interface AskResult {
  text: string;
  provider: 'claude' | 'gemini' | 'ollama';
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

export async function ask(
  guildId: string,
  userId: string,
  prompt: string,
  provider: Provider = 'auto',
  allowThinking = true,
): Promise<AskResult> {
  const resolved = resolveProvider(provider, userId);
  const cfg = getAIConfig(userId);
  // Use the configured model only if it matches the resolved provider, otherwise use the default for that provider
  const actualModel = cfg.provider === resolved ? cfg.model
    : resolved === 'claude' ? 'claude-sonnet-4-6'
    : resolved === 'ollama' ? getOllamaModel()
    : 'gemini-3.1-flash-lite-preview';

  if (isLimitReached(userId, actualModel)) {
    const { getDailyLimit } = await import('../usageLimit');
    throw new DailyLimitError(actualModel, getDailyLimit(actualModel) ?? 0);
  }

  const history = getHistory(guildId, userId);

  if (resolved === 'claude') {
    const result = await askClaude(history, prompt, userId);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', prompt);
    saveMessage(guildId, userId, 'assistant', result.text);
    return { text: result.text, provider: 'claude', model: actualModel, tokenUsage: result.usage };
  }

  if (resolved === 'ollama') {
    const result = await askOllama(history, prompt, actualModel, allowThinking);
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

  const result = await askGemini(history, prompt, userId);
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

export async function askWithImage(
  guildId: string,
  userId: string,
  prompt: string,
  imageBase64: string,
  imageMime: string,
  provider: Provider = 'auto',
): Promise<AskResult> {
  const resolved = resolveProvider(provider, userId);
  const cfg = getAIConfig(userId);
  const actualModel = cfg.provider === resolved ? cfg.model
    : resolved === 'claude' ? 'claude-sonnet-4-6'
    : resolved === 'ollama' ? getOllamaModel()
    : 'gemini-3.1-flash-lite-preview';

  if (isLimitReached(userId, actualModel)) {
    const { getDailyLimit } = await import('../usageLimit');
    throw new DailyLimitError(actualModel, getDailyLimit(actualModel) ?? 0);
  }

  // Ollama doesn't support images — fallback to Claude or Gemini
  const imageProvider = resolved === 'ollama'
    ? (claudeAvailable() ? 'claude' : geminiAvailable() ? 'gemini' : resolved)
    : resolved;

  if (imageProvider === 'claude') {
    const result = await askClaudeWithImage(prompt, imageBase64, imageMime, userId);
    incrementUsage(userId, actualModel);
    saveMessage(guildId, userId, 'user', `[image] ${prompt}`);
    saveMessage(guildId, userId, 'assistant', result.text);
    return { text: result.text, provider: 'claude', model: actualModel, tokenUsage: result.usage };
  }

  if (imageProvider === 'gemini') {
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

function resolveProvider(provider: Provider, userId?: string): 'claude' | 'gemini' | 'ollama' {
  if (provider === 'auto') {
    const configured = getAIConfig(userId).provider;
    if (configured === 'ollama' && ollamaAvailable()) return 'ollama';
    if (configured === 'gemini' && geminiAvailable()) return 'gemini';
    if (configured === 'claude' && claudeAvailable()) return 'claude';
    if (geminiAvailable()) return 'gemini';
    if (claudeAvailable()) return 'claude';
    if (ollamaAvailable()) return 'ollama';
    throw new Error('No AI provider available');
  }
  if (provider === 'claude') {
    if (!claudeAvailable()) throw new Error('Claude provider is not available (missing API key)');
    return 'claude';
  }
  if (provider === 'ollama') {
    if (!ollamaAvailable()) throw new Error('Ollama is not configured (set OLLAMA_HOST or OLLAMA_MODEL in .env)');
    return 'ollama';
  }
  if (!geminiAvailable()) throw new Error('Gemini provider is not available (missing API key)');
  return 'gemini';
}
