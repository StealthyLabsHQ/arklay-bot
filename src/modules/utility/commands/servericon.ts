import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const servericon: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('servericon')
    .setDescription('Display the server icon and banner in full resolution') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;

    const icon   = guild.iconURL({ size: 4096, extension: 'png' });
    const banner = guild.bannerURL({ size: 4096, extension: 'png' });

    if (!icon && !banner) {
      await interaction.reply({ content: 'This server has no icon or banner.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name);

    if (icon) {
      embed.setImage(icon);
      embed.setDescription(`[Icon URL](${icon})${banner ? ` • [Banner URL](${banner})` : ''}`);
    }

    if (banner) embed.setImage(banner);

    const embeds = [];

    if (icon) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${guild.name} — Icon`)
          .setImage(icon)
          .setURL(icon)
      );
    }

    if (banner) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${guild.name} — Banner`)
          .setImage(banner)
          .setURL(banner)
      );
    }

    await interaction.reply({ embeds });
  },
};

export default servericon;
