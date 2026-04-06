import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const qrcode: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('qrcode')
    .setDescription('Generate a QR code')
    .addStringOption((opt) =>
      opt.setName('text').setDescription('Text or URL to encode').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('size').setDescription('Image size in pixels (default 300)').setMinValue(100).setMaxValue(1000).setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const text = interaction.options.getString('text', true);
    const size = interaction.options.getInteger('size') ?? 300;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;

    const embed = new EmbedBuilder()
      .setColor(0x2c3e50)
      .setTitle('QR Code')
      .setDescription(`\`${text.slice(0, 200)}\``)
      .setImage(qrUrl)
      .setFooter({ text: `${size}x${size}px` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default qrcode;
