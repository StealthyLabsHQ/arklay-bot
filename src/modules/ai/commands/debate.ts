import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { claudeAvailable, geminiAvailable, openaiAvailable, ollamaAvailable } from '../../../services/ai/availability';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { logger } from '../../../services/logger';

const COOLDOWN_MS = 30_000;

type AISide = { name: string; emoji: string; fn: (prompt: string, userId: string) => Promise<string> };

function getAvailableSides(): AISide[] {
  const sides: AISide[] = [];
  if (claudeAvailable()) {
    sides.push({
      name: 'Claude',
      emoji: '\uD83D\uDFE0',
      fn: async (prompt, userId) => {
        const { askClaude } = await import('../../../services/ai/anthropic');
        return (await askClaude([], prompt, userId)).text;
      },
    });
  }
  if (geminiAvailable()) {
    sides.push({
      name: 'Gemini',
      emoji: '\uD83D\uDD35',
      fn: async (prompt, userId) => {
        const { askGemini } = await import('../../../services/ai/google');
        return (await askGemini([], prompt, userId)).text;
      },
    });
  }
  if (openaiAvailable()) {
    sides.push({
      name: 'ChatGPT',
      emoji: '\uD83D\uDFE2',
      fn: async (prompt, userId) => {
        const { askOpenAI } = await import('../../../services/ai/openai');
        return (await askOpenAI([], prompt, userId)).text;
      },
    });
  }
  if (ollamaAvailable()) {
    sides.push({
      name: 'Ollama',
      emoji: '\uD83D\uDFE3',
      fn: async (prompt) => {
        const { askOllama } = await import('../../../services/ai/ollama');
        return (await askOllama([], prompt)).text;
      },
    });
  }
  return sides;
}

const debate: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('debate')
    .setDescription('Watch two AIs debate a topic')
    .addStringOption((opt) =>
      opt.setName('topic').setDescription('The debate topic').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('lang').setDescription('Response language').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sides = getAvailableSides();
    if (sides.length < 2) {
      await interaction.reply({
        content: 'At least 2 AI providers must be enabled for /debate (Claude, Gemini, ChatGPT, or Ollama).',
        ephemeral: true,
      });
      return;
    }

    if (checkCooldown('debate', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('debate', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown — try again in ${secs}s.`, ephemeral: true });
      return;
    }

    const topic = interaction.options.getString('topic', true);
    const lang = interaction.options.getString('lang');
    const langHint = lang ? `Respond in ${lang}. ` : '';

    await interaction.deferReply();

    const forSide = sides[0]!;
    const againstSide = sides[1]!;

    try {
      const forPrompt = `${langHint}You are debating this topic: "${topic}". Argue FOR this position. Be persuasive, use examples. Keep it under 800 characters.`;
      const againstPrompt = `${langHint}You are debating this topic: "${topic}". Argue AGAINST this position. Be persuasive, use counterarguments. Keep it under 800 characters.`;

      const [forResult, againstResult] = await Promise.all([
        forSide.fn(forPrompt, interaction.user.id),
        againstSide.fn(againstPrompt, interaction.user.id),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Debate: ${topic.slice(0, 200)}`)
        .addFields(
          { name: `${forSide.emoji} ${forSide.name} (FOR)`, value: forResult.slice(0, 1024) },
          { name: `${againstSide.emoji} ${againstSide.name} (AGAINST)`, value: againstResult.slice(0, 1024) },
        )
        .setFooter({ text: `${forSide.name} vs ${againstSide.name} \u2022 AI opinions are generated, not factual` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, '/debate failed');
      await interaction.editReply('Could not generate debate. Try again later.');
    }
  },
};

export default debate;
