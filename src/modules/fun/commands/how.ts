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

function makeBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const how: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('how')
    .setDescription('How <trait> is <thing>?')
    .addStringOption((opt) =>
      opt.setName('trait').setDescription('The trait (e.g. cool, smart, sus)').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('thing').setDescription('The thing or person to judge').setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const trait = interaction.options.getString('trait', true);
    const thing = interaction.options.getString('thing', true);
    const pct = hashString((trait + thing).toLowerCase()) % 101; // 0-100
    const bar = makeBar(pct);

    const embed = new EmbedBuilder()
      .setColor(pct >= 70 ? 0x57f287 : pct >= 40 ? 0xfee75c : 0xed4245)
      .setTitle(`How ${trait} is ${thing}?`)
      .setDescription(`${bar} **${pct}%**`)
      .setFooter({ text: 'Results may vary (they won\'t)' });

    await interaction.reply({ embeds: [embed] });
  },
};

export default how;
