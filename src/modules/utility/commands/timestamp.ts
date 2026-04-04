import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const FORMATS: { style: string; flag: string; label: string }[] = [
  { style: 'Short Time',      flag: 't', label: 't' },
  { style: 'Long Time',       flag: 'T', label: 'T' },
  { style: 'Short Date',      flag: 'd', label: 'd' },
  { style: 'Long Date',       flag: 'D', label: 'D' },
  { style: 'Short Date/Time', flag: 'f', label: 'f' },
  { style: 'Long Date/Time',  flag: 'F', label: 'F' },
  { style: 'Relative',        flag: 'R', label: 'R' },
];

const timestamp: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Convert a date to all Discord timestamp formats')
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Date string (e.g. 2025-12-25, December 25 2025 3pm, etc.)')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('date', true);
    const parsed = new Date(input);

    if (isNaN(parsed.getTime())) {
      await interaction.reply({
        content: 'Invalid date. Try formats like `2025-12-25`, `December 25 2025`, or `2025-12-25T15:00`.',
        ephemeral: true,
      });
      return;
    }

    const unix = Math.floor(parsed.getTime() / 1000);

    const lines = FORMATS.map(({ style, flag }) => {
      const raw = `<t:${unix}:${flag}>`;
      return `**${style}** — ${raw}\n\`${raw}\``;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Discord Timestamps')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Unix: ${unix}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default timestamp;
