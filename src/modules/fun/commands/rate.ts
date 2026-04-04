import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function makeBar(score: number, max: number = 10): string {
  const filled = Math.round((score / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const rate: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Rate something from 0 to 10')
    .addStringOption((opt) =>
      opt.setName('thing').setDescription('What to rate').setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const thing = interaction.options.getString('thing', true);
    const score = hashString(thing.toLowerCase()) % 11; // 0-10
    const bar = makeBar(score);

    const embed = new EmbedBuilder()
      .setColor(score >= 7 ? 0x57f287 : score >= 4 ? 0xfee75c : 0xed4245)
      .setTitle(`Rating: ${thing}`)
      .setDescription(`${bar} **${score}/10**`)
      .setFooter({ text: 'Totally objective and scientific rating' });

    await interaction.reply({ embeds: [embed] });
  },
};

export default rate;
