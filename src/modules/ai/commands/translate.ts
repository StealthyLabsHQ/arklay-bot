import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask } from '../router';
import { isVertexMode } from '../providers/anthropic';
import { getAIConfig, getModelDisplayInfo } from '../../../services/aiConfig';
import { remaining } from '../../../services/usageLimit';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { logger } from '../../../services/logger';

const COOLDOWN_MS = 8_000;

const translate: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text using AI')
    .addStringOption((opt) =>
      opt.setName('language').setDescription('Target language (e.g. English, French, Japanese)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('text').setDescription('Text to translate').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('translate', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('translate', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown - try again in ${secs}s.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const language = interaction.options.getString('language', true);
    const text     = interaction.options.getString('text', true);
    const prompt   = `Translate the text inside <text> tags to ${language}. Output ONLY the translation, nothing else.\n\n<text>${text}</text>`;

    try {
      const result = await ask(interaction.guildId ?? 'dm', interaction.user.id, prompt);
      const translation = result.text.length > 1800 ? result.text.slice(0, 1797) + '...' : result.text;
      const { name, source } = getModelDisplayInfo(
        result.provider,
        getAIConfig(interaction.user.id).model,
        result.provider === 'claude' && isVertexMode()
      );
      const left = remaining(interaction.user.id, getAIConfig(interaction.user.id).model);
      const quota = left !== null ? ` \u2022 ${left} req left today` : '';
      const footer = `-# Translated by **${name}** (${source})${quota}`;
      await interaction.editReply({ content: `**${language}:**\n${translation}\n${footer}` });
    } catch (err) {
      logger.error({ err }, '/translate failed');
      await interaction.editReply('Translation failed. Try again later.');
    }
  },
};

export default translate;
