import { config } from '../config';

// Lightweight provider availability checks — no SDK imports
// Use this instead of importing full provider modules just to check isAvailable()

export function claudeAvailable(): boolean {
  return !!(config.GOOGLE_CLOUD_PROJECT || config.ANTHROPIC_API_KEY);
}

export function geminiAvailable(): boolean {
  return !!config.GOOGLE_AI_API_KEY;
}

export function openaiAvailable(): boolean {
  return !!config.OPENAI_API_KEY;
}

export function ollamaAvailable(): boolean {
  if (!config.OLLAMA_ENABLED) return false;
  return !!config.OLLAMA_HOST || !!config.OLLAMA_MODEL;
}

export function anyProviderAvailable(): boolean {
  return claudeAvailable() || geminiAvailable() || openaiAvailable() || ollamaAvailable();
}
