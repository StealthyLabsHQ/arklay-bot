import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const autoplay: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay - automatically add similar tracks when queue ends') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }

    queue.autoplay = !queue.autoplay;

    const embed = new EmbedBuilder()
      .setColor(queue.autoplay ? 0x57f287 : 0xed4245)
      .setDescription(`Autoplay ${queue.autoplay ? 'enabled' : 'disabled'}`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default autoplay;
