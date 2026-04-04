import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const coinflip: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const heads = Math.random() < 0.5;
    const embed = new EmbedBuilder()
      .setColor(heads ? 0xfee75c : 0x5865f2)
      .setTitle(heads ? 'Heads!' : 'Tails!')
      .setDescription(heads ? '🪙 The coin landed on **heads**.' : '🪙 The coin landed on **tails**.');

    await interaction.reply({ embeds: [embed] });
  },
};

export default coinflip;
