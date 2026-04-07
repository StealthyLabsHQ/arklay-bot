import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';

const serverinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Server information')
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Display server information')
    )
    .addSubcommand((sub) =>
      sub.setName('icon').setDescription('Display the server icon and banner in full resolution')
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'icon') {
      const icon   = guild.iconURL({ size: 4096, extension: 'png' });
      const banner = guild.bannerURL({ size: 4096, extension: 'png' });

      if (!icon && !banner) {
        await interaction.reply({ content: 'This server has no icon or banner.', ephemeral: true });
        return;
      }

      const embeds = [];
      if (icon) {
        embeds.push(new EmbedBuilder().setColor(0x5865f2).setTitle(`${guild.name} — Icon`).setImage(icon).setURL(icon));
      }
      if (banner) {
        embeds.push(new EmbedBuilder().setColor(0x5865f2).setTitle(`${guild.name} — Banner`).setImage(banner).setURL(banner));
      }
      await interaction.reply({ embeds });
      return;
    }

    // sub === 'info'
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Owner',       value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members',     value: `${guild.memberCount}`, inline: true },
        { name: 'Boost level', value: `${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`, inline: true },
        { name: 'Channels',    value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Roles',       value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Created',     value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default serverinfo;
