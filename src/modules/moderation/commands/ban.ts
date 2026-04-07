import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { logCase } from '../../../services/modcases';

const ban: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (admin only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for ban').setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('delete_history')
        .setDescription('Delete message history')
        .setRequired(false)
        .addChoices(
          { name: 'None',      value: '0' },
          { name: 'Last hour', value: '3600' },
          { name: 'Last 24h',  value: '86400' },
          { name: 'Last 7 days', value: '604800' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const user     = interaction.options.getUser('user', true);
    const reason   = interaction.options.getString('reason') ?? 'No reason provided';
    const delSecs  = parseInt(interaction.options.getString('delete_history') ?? '0', 10);
    const member   = interaction.guild?.members.cache.get(user.id);

    if (member && !member.bannable) {
      await interaction.reply({ content: 'I cannot ban this user (higher role or missing permissions).', ephemeral: true });
      return;
    }

    await interaction.guild!.members.ban(user, { reason, deleteMessageSeconds: delSecs });
    logCase(interaction.guildId!, user.id, interaction.user.id, 'ban', reason);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('User Banned')
      .addFields(
        { name: 'User',   value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Reason', value: reason },
      )
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default ban;
