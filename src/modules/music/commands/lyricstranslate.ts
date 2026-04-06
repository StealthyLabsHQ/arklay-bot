import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ask } from '../../../services/ai/router';
import { logger } from '../../../services/logger';

interface LrcLibResult {
  trackName: string;
  artistName: string;
  plainLyrics?: string;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\(Official\s*(Music\s*)?Video\)/gi, '')
    .replace(/\(Official\s*Audio\)/gi, '')
    .replace(/\[Official\s*(Music\s*)?Video\]/gi, '')
    .replace(/\[MV\]/gi, '')
    .replace(/\bft\.?\s*/gi, '')
    .replace(/\bfeat\.?\s*/gi, '')
    .replace(/\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const lyricstranslate: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('lyrics-translate')
    .setDescription('Translate the current track\'s lyrics')
    .addStringOption((opt) =>
      opt.setName('language').setDescription('Target language (e.g. French, Spanish, Japanese)').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue?.currentTrack) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const language = interaction.options.getString('language', true);
    const cleaned = cleanTitle(queue.currentTrack.title);

    try {
      const res = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(cleaned)}`);
      const results = await res.json() as LrcLibResult[];

      if (!results?.length || !results[0]!.plainLyrics) {
        await interaction.editReply(`No lyrics found for **${cleaned}**.`);
        return;
      }

      const hit = results[0]!;
      const lyrics = hit.plainLyrics!.slice(0, 3000);

      const result = await ask(
        interaction.guildId ?? 'dm',
        interaction.user.id,
        `Translate these song lyrics to ${language}. Keep the formatting (line breaks). Output ONLY the translated lyrics, no commentary.\n\n<lyrics>\n${lyrics}\n</lyrics>`,
        'auto',
        false,
      );

      const translated = result.text.length > 4000 ? result.text.slice(0, 3997) + '...' : result.text;

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`${hit.trackName} - ${hit.artistName}`)
        .setDescription(translated)
        .setFooter({ text: `Translated to ${language} \u2022 Lyrics from lrclib.net` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, '/lyrics-translate failed');
      await interaction.editReply('Could not translate lyrics. Try again later.');
    }
  },
};

export default lyricstranslate;
