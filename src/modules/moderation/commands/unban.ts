import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const unban: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user (admin only)')
    .addStringOption((opt) => opt.setName('userid').setDescription('User ID to unban').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const userId = interaction.options.getString('userid', true).trim();
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    try {
      await interaction.guild!.members.unban(userId, reason);
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('User Unbanned')
        .setDescription(`<@${userId}> (${userId}) has been unbanned.`)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `By ${interaction.user.username}` });
      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({ content: 'Could not unban. Check the user ID.', ephemeral: true });
    }
  },
};

export default unban;
