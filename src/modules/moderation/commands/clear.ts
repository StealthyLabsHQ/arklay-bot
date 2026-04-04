import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const clear: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages from the channel (admin only)')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions to use this command.', ephemeral: true });
      return;
    }

    const amount  = interaction.options.getInteger('amount', true);
    const channel = interaction.channel as TextChannel;

    if (!channel || !('bulkDelete' in channel)) {
      await interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const deleted = await channel.bulkDelete(amount, true);

    await interaction.editReply(`Deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''}.`);
  },
};

export default clear;
