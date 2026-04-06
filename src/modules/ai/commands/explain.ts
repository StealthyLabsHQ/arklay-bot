import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask, NetworkError, SafetyError, RateLimitError, DailyLimitError } from '../../../services/ai/router';
import { withThinkingTimer } from '../../../services/thinkingTimer';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { remaining } from '../../../services/usageLimit';
import { getModelDisplayInfo } from '../../../services/aiConfig';
const isVertexMode = () => !!process.env.GOOGLE_CLOUD_PROJECT;
import { logger } from '../../../services/logger';

const COOLDOWN_MS = 8_000;
const LEARN_MORE = 'https://stealthylabs.eu/docs/arklay-bot';

const LEVELS: Record<string, string> = {
  child: 'Explain like I\'m 5 years old. Use very simple words, fun analogies, and short sentences.',
  beginner: 'Explain for a complete beginner. No jargon, use everyday analogies, step by step.',
  intermediate: 'Explain for someone with basic knowledge. Some technical terms are OK if defined.',
  expert: 'Explain at an expert level. Use precise terminology, cite relevant concepts, be thorough.',
};

const explain: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('explain')
    .setDescription('Explain a topic at your level')
    .addStringOption((opt) =>
      opt.setName('topic').setDescription('What to explain').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('level')
        .setDescription('Explanation level')
        .setRequired(false)
        .addChoices(
          { name: 'Like I\'m 5', value: 'child' },
          { name: 'Beginner', value: 'beginner' },
          { name: 'Intermediate', value: 'intermediate' },
          { name: 'Expert', value: 'expert' },
        )
    )
    .addStringOption((opt) =>
      opt.setName('lang').setDescription('Response language').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('explain', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('explain', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown — try again in ${secs}s.`, ephemeral: true });
      return;
    }

    const topic = interaction.options.getString('topic', true);
    const level = interaction.options.getString('level') ?? 'beginner';
    const lang = interaction.options.getString('lang');

    await interaction.deferReply();

    const levelPrompt = LEVELS[level] ?? LEVELS['beginner']!;
    let prompt = `${levelPrompt}\n\nExplain: ${topic}`;
    if (lang) prompt = `[Respond in ${lang}] ${prompt}`;

    try {
      const result = await withThinkingTimer(
        interaction,
        ask(interaction.guildId ?? 'dm', interaction.user.id, prompt, 'auto', false),
      );

      const { name, source } = getModelDisplayInfo(result.provider, result.model, result.provider === 'claude' && isVertexMode());
      const left = remaining(interaction.user.id, result.model);
      const quota = left !== null ? ` \u2022 ${left} req left` : '';

      const text = result.text.length > 1900 ? result.text.slice(0, 1897) + '...' : result.text;
      await interaction.editReply(`${text}\n-# **${name}** (${source})${quota} \u2022 [Learn more](${LEARN_MORE})`);
    } catch (err) {
      logger.error({ err }, '/explain failed');
      if (err instanceof DailyLimitError) await interaction.editReply(`Daily limit reached for **${err.model}**.`);
      else if (err instanceof RateLimitError) await interaction.editReply('Rate limited — try again shortly.');
      else if (err instanceof SafetyError) await interaction.editReply('This request could not be processed.');
      else await interaction.editReply('The AI service is temporarily unavailable.');
    }
  },
};

export default explain;
