import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { logger } from '../../../services/logger';

interface ZenQuote {
  q: string;
  a: string;
}

const quote: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Get a random inspirational quote') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const res = await fetch('https://zenquotes.io/api/random', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const data = await res.json() as ZenQuote[];

      if (!data?.length || !data[0]!.q) {
        await interaction.reply({ content: 'Could not fetch a quote. Try again.', ephemeral: true });
        return;
      }

      const { q, a } = data[0]!;

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setDescription(`*"${q}"*`)
        .setFooter({ text: `— ${a}` });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.warn({ err }, '/quote failed');
      await interaction.reply({ content: 'Could not fetch a quote. Try again later.', ephemeral: true });
    }
  },
};

export default quote;
