import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const roleinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Display information about a role')
    .addRoleOption((opt) => opt.setName('role').setDescription('Role to inspect').setRequired(true)) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const rawRole = interaction.options.getRole('role', true);
    const guildRole = interaction.guild!.roles.cache.get(rawRole.id);
    const role = guildRole ?? rawRole;

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x5865f2)
      .setTitle(`Role: ${role.name}`)
      .addFields(
        { name: 'ID',          value: role.id,                                 inline: true },
        { name: 'Color',       value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
        { name: 'Members',     value: `${guildRole?.members.size ?? '?'}`,     inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No',        inline: true },
        { name: 'Hoisted',     value: guildRole?.hoist ? 'Yes' : 'No',        inline: true },
        { name: 'Position',    value: `${role.position}`,                      inline: true },
        { name: 'Created',     value: guildRole ? `<t:${Math.floor(guildRole.createdTimestamp / 1000)}:R>` : 'Unknown', inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default roleinfo;
