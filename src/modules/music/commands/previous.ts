import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const previous: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Play the previous track again') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }

    if (queue.history.length === 0) {
      await interaction.reply({ content: 'No previous track in history.', ephemeral: true });
      return;
    }

    const prev = queue.history.shift()!;
    // Put it at the front of the queue so it plays next
    queue.tracks.unshift(prev);

    // If something is playing, skip to trigger the previous track
    if (queue.isPlaying) {
      queue.skip();
      await interaction.reply(`Playing previous: **${prev.title}**`);
    } else {
      await queue.playNext();
      await interaction.reply(`Playing previous: **${prev.title}**`);
    }
  },
};

export default previous;
