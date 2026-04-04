import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

function parseHex(input: string): number | null {
  const cleaned = input.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return parseInt(cleaned, 16);
}

function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

const color: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Preview a color from its hex code')
    .addStringOption((opt) =>
      opt.setName('hex').setDescription('Hex color code (e.g. #ff5733 or ff5733)').setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('hex', true);
    const hexValue = parseHex(input);

    if (hexValue === null) {
      await interaction.reply({
        content: 'Invalid hex color. Use format `#ff5733` or `ff5733`.',
        ephemeral: true,
      });
      return;
    }

    const hexStr = `#${hexValue.toString(16).padStart(6, '0').toUpperCase()}`;
    const { r, g, b } = hexToRgb(hexValue);

    const embed = new EmbedBuilder()
      .setColor(hexValue)
      .setTitle(hexStr)
      .addFields(
        { name: 'Hex',   value: hexStr,              inline: true },
        { name: 'RGB',   value: `${r}, ${g}, ${b}`,  inline: true },
        { name: 'Integer', value: `${hexValue}`,      inline: true },
      )
      .setDescription(`${'█'.repeat(12)}`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default color;
