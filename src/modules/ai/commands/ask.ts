import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask, askWithImage, NetworkError, SafetyError, RateLimitError, DailyLimitError, CloudAIDisabledError, type Provider, type ModelOverride } from '../router';
import { withThinkingTimer } from '../../../services/thinkingTimer';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { remaining } from '../../../services/usageLimit';
import { getAIConfig, getModelDisplayInfo } from '../../../services/aiConfig';
const isVertexMode = () => !!process.env.GOOGLE_CLOUD_PROJECT;
import { logger } from '../../../services/logger';

const BASE_COOLDOWN_MS = 8_000;
const MAX_COOLDOWN_MS  = 60_000;
const LEARN_MORE = 'https://stealthylabs.eu/docs/arklay-bot';

let askCooldown    = BASE_COOLDOWN_MS;
let lastAskError   = 0;

function getAskCooldown(): number {
  if (Date.now() - lastAskError > 300_000) askCooldown = BASE_COOLDOWN_MS;
  return askCooldown;
}

const askCommand: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask a question to Claude or Gemini')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Your question').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('provider')
        .setDescription('AI provider to use')
        .setRequired(false)
        .addChoices(
          { name: 'Auto (default)', value: 'auto' },
          { name: 'Claude (Anthropic)', value: 'claude' },
          { name: 'Gemini (Google)', value: 'gemini' },
          { name: 'OpenAI (ChatGPT)', value: 'openai' },
          { name: 'Ollama (Local)', value: 'ollama' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('model')
        .setDescription('Force a specific model for this request (overrides your /setmodel preference)')
        .setRequired(false)
        .addChoices(
          { name: 'Gemini 3 Flash',     value: 'gemini|gemini-3-flash-preview' },
          { name: 'Gemini Flash Lite',   value: 'gemini|gemini-3.1-flash-lite-preview' },
          { name: 'Claude Haiku 4.5',    value: 'claude|claude-haiku-4-5' },
          { name: 'GPT-5.4 Nano',        value: 'openai|gpt-5.4-nano' },
          { name: 'GPT-5.4 Mini',        value: 'openai|gpt-5.4-mini' },
        )
    )
    .addAttachmentOption((opt) =>
      opt.setName('image').setDescription('Attach an image for visual analysis').setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('lang')
        .setDescription('Response language')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const cd = getAskCooldown();
    if (checkCooldown('ask', interaction.user.id, cd)) {
      const secs = (remainingCooldown('ask', interaction.user.id, cd) / 1000).toFixed(0);
      const extra = cd > BASE_COOLDOWN_MS ? ' (API busy, cooldown extended)' : '';
      await interaction.reply({ content: `Cooldown active - try again in ${secs}s.${extra}`, ephemeral: true });
      return;
    }

    try { await interaction.deferReply(); } catch { return; }

    const question = interaction.options.getString('question', true);
    const rawProvider = interaction.options.getString('provider') ?? 'auto';
    const provider = (['auto', 'claude', 'gemini', 'openai', 'ollama'].includes(rawProvider) ? rawProvider : 'auto') as Provider;
    const lang     = interaction.options.getString('lang');
    const image    = interaction.options.getAttachment('image');

    // Parse and validate the model override (server-side whitelist)
    const ALLOWED_OVERRIDES: Record<string, ModelOverride> = {
      'gemini|gemini-3-flash-preview':        { provider: 'gemini', model: 'gemini-3-flash-preview' },
      'gemini|gemini-3.1-flash-lite-preview': { provider: 'gemini', model: 'gemini-3.1-flash-lite-preview' },
      'claude|claude-haiku-4-5':              { provider: 'claude', model: 'claude-haiku-4-5' },
      'openai|gpt-5.4-nano':                  { provider: 'openai', model: 'gpt-5.4-nano' },
      'openai|gpt-5.4-mini':                  { provider: 'openai', model: 'gpt-5.4-mini' },
    };
    const rawModel = interaction.options.getString('model');
    const modelOverride = rawModel ? ALLOWED_OVERRIDES[rawModel] : undefined;

    try {
      const finalPrompt = lang ? `[Respond in ${lang}] ${question}` : question;

      let result;
      if (image && image.contentType?.startsWith('image/')) {
        const res = await fetch(image.url);
        const buf = Buffer.from(await res.arrayBuffer());
        const base64 = buf.toString('base64');
        const mime = image.contentType || 'image/png';
        result = await withThinkingTimer(
          interaction,
          askWithImage(interaction.guildId ?? 'dm', interaction.user.id, finalPrompt, base64, mime, provider, modelOverride),
        );
      } else {
        result = await withThinkingTimer(
          interaction,
          ask(interaction.guildId ?? 'dm', interaction.user.id, finalPrompt, provider, true, modelOverride),
        );
      }

      const { name, source } = getModelDisplayInfo(
        result.provider,
        result.model,
        result.provider === 'claude' && isVertexMode()
      );

      const parts: string[] = [];

      // Daily quota (Claude + Gemini)
      const left = remaining(interaction.user.id, result.model);
      if (left !== null) parts.push(`${left} req left today`);

      // Token usage
      if (result.tokenUsage) {
        const u = result.tokenUsage;
        const total = u.inputTokens + u.outputTokens;
        let tokenStr = `${total} tokens (${u.inputTokens} in · ${u.outputTokens} out)`;
        if (u.cacheReadTokens && u.cacheReadTokens > 0) {
          tokenStr += ` · ${u.cacheReadTokens} cached`;
        }
        parts.push(tokenStr);
      }

      parts.push(`[Learn more](${LEARN_MORE})`);

      const text = result.text.length > 1900 ? result.text.slice(0, 1897) + '...' : result.text;

      const content = [
        text,
        `-# Generated by **${name}** (${source}). AI can make mistakes. • ${parts.join(' • ')}`,
      ].join('\n');

      askCooldown = Math.max(BASE_COOLDOWN_MS, Math.floor(askCooldown * 0.7));
      await interaction.editReply({ content });
    } catch (err) {
      lastAskError = Date.now();
      askCooldown = Math.min(MAX_COOLDOWN_MS, askCooldown * 2);
      logger.error({ err }, '/ask failed (cooldown now %ds)', askCooldown / 1000);
      await interaction.editReply(errorMessage(err));
    }
  },
};

function errorMessage(err: unknown): string {
  if (err instanceof CloudAIDisabledError) return 'Cloud AI is currently disabled. Contact the bot owner.';
  if (err instanceof DailyLimitError) {
    return `Daily limit reached for **${err.model}** (${err.limit} requests/day). Resets at midnight UTC.`;
  }
  if (err instanceof RateLimitError) return 'Too many requests, please try again in a few seconds.';
  if (err instanceof SafetyError) return 'This request could not be processed.';
  if (err instanceof NetworkError) return 'The AI service is temporarily unavailable.';
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('not available')) return msg;
  return 'The AI service is temporarily unavailable.';
}

export default askCommand;
