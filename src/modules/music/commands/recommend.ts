import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ask } from '../../../services/ai/router';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { logger } from '../../../services/logger';

const COOLDOWN_MS = 15_000;

const recommend: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('AI suggests tracks based on your queue and history') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('recommend', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('recommend', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown — try again in ${secs}s.`, ephemeral: true });
      return;
    }

    const queue = getQueues().get(interaction.guildId!);
    const songs: string[] = [];

    if (queue?.currentTrack) songs.push(queue.currentTrack.title);
    if (queue?.tracks) songs.push(...queue.tracks.slice(0, 5).map((t) => t.title));
    if (queue?.history) songs.push(...queue.history.slice(0, 10).map((t) => t.title));

    if (songs.length === 0) {
      await interaction.reply({ content: 'Play some music first so I can learn your taste.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const unique = [...new Set(songs)].slice(0, 15);
    const prompt = `Based on these songs the user has been listening to:\n${unique.map((s) => `- ${s}`).join('\n')}\n\nRecommend 10 similar songs they might enjoy. For each, include Artist - Title. Only suggest REAL songs that exist. No numbering, one per line, no explanation.`;

    try {
      const result = await ask(interaction.guildId ?? 'dm', interaction.user.id, prompt, 'auto', false);

      const lines = result.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 10);
      const list = lines.map((l, i) => `**${i + 1}.** ${l}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle('Recommended for You')
        .setDescription(list || 'No recommendations generated.')
        .setFooter({ text: 'Use /play to add any of these to the queue' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, '/recommend failed');
      await interaction.editReply('Could not generate recommendations. Try again later.');
    }
  },
};

export default recommend;
