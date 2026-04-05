import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const disconnect: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from the voice channel') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue) {
      await interaction.reply({ content: 'The bot is not in a voice channel.', ephemeral: true });
      return;
    }

    queue.destroy();
    getQueues().delete(interaction.guildId!);
    await interaction.reply('Disconnected.');
  },
};

export default disconnect;
