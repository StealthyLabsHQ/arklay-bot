import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const dice: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll dice')
    .addIntegerOption((opt) =>
      opt.setName('count').setDescription('Number of dice (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName('sides').setDescription('Number of sides (2-100)').setMinValue(2).setMaxValue(100).setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const count = interaction.options.getInteger('count') ?? 1;
    const sides = interaction.options.getInteger('sides') ?? 6;

    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);

    const display = sides === 6
      ? rolls.map((r) => DICE_EMOJI[r]).join(' ')
      : rolls.map((r) => `**${r}**`).join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎲 ${count}d${sides}`)
      .setDescription(`${display}${count > 1 ? `\n\nTotal: **${total}**` : ''}`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default dice;
