import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const serverinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display server information') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Owner',          value: `<@${guild.ownerId}>`,                       inline: true },
        { name: 'Members',        value: `${guild.memberCount}`,                      inline: true },
        { name: 'Boost level',    value: `${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`, inline: true },
        { name: 'Channels',       value: `${guild.channels.cache.size}`,              inline: true },
        { name: 'Roles',          value: `${guild.roles.cache.size}`,                 inline: true },
        { name: 'Created',        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default serverinfo;
