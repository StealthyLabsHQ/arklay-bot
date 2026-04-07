import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { logCase } from '../../../services/modcases';

const kick: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server (admin only)')
    .addUserOption((opt) => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) {
      await interaction.reply({ content: 'User not found.', ephemeral: true });
      return;
    }
    if (!target.kickable) {
      await interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
      return;
    }

    await target.kick(reason);
    logCase(interaction.guildId!, target.id, interaction.user.id, 'kick', reason);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('User Kicked')
      .addFields(
        { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default kick;
