import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const choose: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Randomly pick from a list of options')
    .addStringOption((opt) =>
      opt.setName('options').setDescription('Comma-separated options (e.g. pizza, sushi, tacos)').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const raw     = interaction.options.getString('options', true);
    const choices = raw.split(',').map((s) => s.trim()).filter(Boolean);

    if (choices.length < 2) {
      await interaction.reply({ content: 'Provide at least 2 options separated by commas.', ephemeral: true });
      return;
    }

    const pick = choices[Math.floor(Math.random() * choices.length)]!;

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('I choose...')
      .setDescription(`**${pick}**`)
      .setFooter({ text: `Out of ${choices.length} options` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default choose;
