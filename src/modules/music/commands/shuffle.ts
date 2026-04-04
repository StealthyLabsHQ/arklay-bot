import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const shuffle: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue || queue.tracks.length < 2) {
      await interaction.reply({ content: 'Not enough tracks in the queue to shuffle.', ephemeral: true });
      return;
    }

    queue.shuffle();
    await interaction.reply(`Queue shuffled. (${queue.tracks.length} tracks)`);
  },
};

export default shuffle;
