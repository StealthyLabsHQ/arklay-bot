import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const role: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Toggle a role on a user (add if missing, remove if present)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to toggle the role on').setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to toggle').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const targetRole = interaction.options.getRole('role', true);
    const guild = interaction.guild!;
    const member = guild.members.cache.get(targetUser.id);

    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    // Check bot's role hierarchy
    const botMember = guild.members.me;
    if (!botMember) {
      await interaction.reply({ content: 'Could not resolve bot member.', ephemeral: true });
      return;
    }

    if (targetRole.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: `I cannot manage ${targetRole} — it is equal to or higher than my highest role.`,
        ephemeral: true,
      });
      return;
    }

    const hasRole = member.roles.cache.has(targetRole.id);

    if (hasRole) {
      await member.roles.remove(targetRole.id);
    } else {
      await member.roles.add(targetRole.id);
    }

    const action = hasRole ? 'Removed' : 'Added';
    const color = hasRole ? 0xed4245 : 0x57f287;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Role ${action}`)
      .addFields(
        { name: 'User', value: `${member}`, inline: true },
        { name: 'Role', value: `${targetRole}`, inline: true },
        { name: 'Action', value: action, inline: true },
      )
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default role;
