// Lightweight provider availability checks — no SDK imports
// Use this instead of importing full provider modules just to check isAvailable()

export function claudeAvailable(): boolean {
  return !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.ANTHROPIC_API_KEY);
}

export function geminiAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

export function openaiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function ollamaAvailable(): boolean {
  const enabled = process.env.OLLAMA_ENABLED?.toLowerCase();
  if (enabled === 'false' || enabled === '0') return false;
  if (enabled === 'true' || enabled === '1') return true;
  return !!process.env.OLLAMA_HOST || !!process.env.OLLAMA_MODEL;
}

export function anyProviderAvailable(): boolean {
  return claudeAvailable() || geminiAvailable() || openaiAvailable() || ollamaAvailable();
}
