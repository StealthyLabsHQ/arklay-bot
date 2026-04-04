import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

interface DictEntry {
  word: string;
  phonetic?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string }>;
  }>;
}

const define: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('define')
    .setDescription('Look up the definition of a word')
    .addStringOption((opt) => opt.setName('word').setDescription('Word to define').setRequired(true)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const word = interaction.options.getString('word', true);

    try {
      const res  = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) {
        await interaction.editReply(`No definition found for **${word}**.`);
        return;
      }

      const data = await res.json() as DictEntry[];
      const entry = data[0]!;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${entry.word}${entry.phonetic ? ` ${entry.phonetic}` : ''}`);

      for (const meaning of entry.meanings.slice(0, 3)) {
        const def = meaning.definitions[0]!;
        let value = def.definition;
        if (def.example) value += `\n*"${def.example}"*`;
        embed.addFields({ name: meaning.partOfSpeech, value });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Could not fetch definition.');
    }
  },
};

export default define;
