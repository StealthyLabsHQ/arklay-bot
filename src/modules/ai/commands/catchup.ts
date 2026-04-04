import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask } from '../router';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { logger } from '../../../services/logger';

const COOLDOWN_MS = 30_000;

const catchup: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('catchup')
    .setDescription('Summarize recent conversation as bullet points')
    .addIntegerOption((opt) =>
      opt
        .setName('messages')
        .setDescription('Number of messages to summarize (10-100, default 50)')
        .setRequired(false)
        .setMinValue(10)
        .setMaxValue(100)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('catchup', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('catchup', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown - try again in ${secs}s.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const limit = interaction.options.getInteger('messages') ?? 50;

    try {
      const messages = await interaction.channel!.messages.fetch({ limit });

      // Anonymize usernames: map each unique author to "User1", "User2", etc.
      const authorMap = new Map<string, string>();
      let userCounter = 0;

      const lines: string[] = [];
      // Messages come newest-first, reverse for chronological order
      const sorted = [...messages.values()].reverse();

      for (const msg of sorted) {
        if (msg.author.bot) continue;
        if (!msg.content) continue;

        const authorId = msg.author.id;
        if (!authorMap.has(authorId)) {
          userCounter++;
          authorMap.set(authorId, `User${userCounter}`);
        }

        lines.push(`${authorMap.get(authorId)}: ${msg.content}`);
      }

      if (lines.length === 0) {
        await interaction.editReply('No messages to summarize.');
        return;
      }

      const text = lines.join('\n');
      const prompt = `Summarize this Discord conversation as concise bullet points. Focus on key topics, decisions, and action items.\n\n<messages>\n${text}\n</messages>`;

      const result = await ask(interaction.guildId ?? 'dm', interaction.user.id, prompt);

      const summary = result.text.length > 4000 ? result.text.slice(0, 3997) + '...' : result.text;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Conversation Catchup')
        .setDescription(summary)
        .setFooter({ text: `${lines.length} messages analyzed · ${result.provider}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, '/catchup failed');
      await interaction.editReply('Could not generate summary. Try again later.');
    }
  },
};

export default catchup;
