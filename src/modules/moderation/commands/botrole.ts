import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { addBotAdminRole, removeBotAdminRole, getBotAdminRoles } from '../../../services/permissions';

const botrole: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('botrole')
    .setDescription('Manage roles that have full bot access')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Grant a role full bot access')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role to add').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Revoke a role\'s bot access')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show all roles with bot access')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);
      addBotAdminRole(guildId, role.id);
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Bot Role - Added')
        .setDescription(`<@&${role.id}> now has full bot access.`);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'remove') {
      const role = interaction.options.getRole('role', true);
      const removed = removeBotAdminRole(guildId, role.id);
      const embed = new EmbedBuilder()
        .setColor(removed ? 0xed4245 : 0x5865f2)
        .setTitle('Bot Role - Removed')
        .setDescription(removed ? `<@&${role.id}> no longer has bot access.` : 'That role was not in the list.');
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const roles = getBotAdminRoles(guildId);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Bot Admin Roles');
      if (roles.length === 0) {
        embed.setDescription('No bot admin roles configured.\nOnly Discord Administrators have full access.');
      } else {
        embed.setDescription(roles.map((id) => `<@&${id}>`).join('\n'));
        embed.setFooter({ text: `${roles.length} role${roles.length !== 1 ? 's' : ''} configured` });
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default botrole;
