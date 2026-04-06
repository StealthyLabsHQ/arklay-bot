import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { claudeAvailable, geminiAvailable } from '../../../services/ai/availability';
import { getAIConfig } from '../../../services/aiConfig';
import { getModelDisplayInfo } from '../../../services/aiConfig';
import { remaining } from '../../../services/usageLimit';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { logger } from '../../../services/logger';

// Anthropic
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

// Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';

const COOLDOWN_MS = 10_000;

function isVertexMode(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT;
}

function getClaudeClient(): Anthropic | AnthropicVertex {
  if (isVertexMode()) {
    return new AnthropicVertex({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      region: process.env.GOOGLE_CLOUD_REGION ?? 'us-east5',
    });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function visionClaude(base64: string, mime: string, prompt: string, model: string): Promise<string> {
  const client = getClaudeClient();
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64 } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Non-text response');
  return block.text;
}

async function visionGemini(base64: string, mime: string, prompt: string, model: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const gemini = genAI.getGenerativeModel({ model });
  const result = await gemini.generateContent([
    prompt,
    { inlineData: { mimeType: mime, data: base64 } },
  ]);
  return result.response.text();
}

const vision: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('vision')
    .setDescription('Analyze an image with AI')
    .addAttachmentOption((opt) =>
      opt.setName('image').setDescription('Image to analyze (PNG, JPG, WEBP)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('prompt').setDescription('What to ask about the image').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('lang').setDescription('Response language').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hasAny = claudeAvailable() || geminiAvailable();
    if (!hasAny) {
      await interaction.reply({ content: 'Vision requires an AI provider API key.', ephemeral: true });
      return;
    }

    if (checkCooldown('vision', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('vision', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown - try again in ${secs}s.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('image', true);
    const rawPrompt  = interaction.options.getString('prompt', true);
    const lang       = interaction.options.getString('lang');
    const prompt     = lang ? `[Respond in ${lang}] ${rawPrompt}` : rawPrompt;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(attachment.contentType ?? '')) {
      await interaction.editReply('Image must be PNG, JPG, or WEBP.');
      return;
    }

    try {
      const res    = await fetch(attachment.url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mime   = attachment.contentType ?? 'image/png';

      // Use the user's configured provider and model
      const cfg = getAIConfig(interaction.user.id);
      let text: string;
      let providerUsed: string;

      if (cfg.provider === 'claude' && claudeAvailable()) {
        text = await visionClaude(base64, mime, prompt, cfg.model);
        providerUsed = 'claude';
      } else if (geminiAvailable()) {
        text = await visionGemini(base64, mime, prompt, cfg.model);
        providerUsed = 'gemini';
      } else if (claudeAvailable()) {
        const fallbackModel = getAIConfig().model; // default claude model
        text = await visionClaude(base64, mime, prompt, fallbackModel);
        providerUsed = 'claude';
      } else {
        await interaction.editReply('No AI provider available.');
        return;
      }

      const { name: modelName, source } = getModelDisplayInfo(providerUsed as 'claude' | 'gemini', cfg.model);
      const left = remaining(interaction.user.id, cfg.model);
      const quota = left !== null ? ` \u2022 ${left} req left today` : '';
      const trimmed = text.length > 1800 ? text.slice(0, 1797) + '...' : text;
      const footer = `-# Analyzed by **${modelName}** (${source})${quota}`;

      await interaction.editReply({ content: `${trimmed}\n${footer}` });
    } catch (err) {
      logger.error({ err }, '/vision failed');
      await interaction.editReply('Could not analyze the image. Try again later.');
    }
  },
};

export default vision;
