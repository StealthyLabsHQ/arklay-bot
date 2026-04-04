import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ask } from '../../../services/ai/router';
import { isAvailable as claudeAvailable } from '../../../services/ai/anthropic';
import { isAvailable as geminiAvailable } from '../../../services/ai/google';
import { logger } from '../../../services/logger';

interface LrcLibResult {
  trackName: string;
  artistName: string;
  plainLyrics?: string;
  syncedLyrics?: string;
}

// Clean YouTube title junk: "(Official Video)", "[MV]", "feat.", "ft.", etc.
function cleanTitle(title: string): string {
  return title
    .replace(/\(Official\s*(Music\s*)?Video\)/gi, '')
    .replace(/\(Official\s*Lyric\s*Video\)/gi, '')
    .replace(/\(Official\s*Audio\)/gi, '')
    .replace(/\(Official\s*MV\)/gi, '')
    .replace(/\(Lyric\s*Video\)/gi, '')
    .replace(/\(Audio\)/gi, '')
    .replace(/\(Visuali[sz]er\)/gi, '')
    .replace(/\[Official\s*(Music\s*)?Video\]/gi, '')
    .replace(/\[MV\]/gi, '')
    .replace(/\[.*?Remix.*?\]/gi, '')
    .replace(/\(.*?Remix.*?\)/gi, '')
    .replace(/\bft\.?\s*/gi, '')
    .replace(/\bfeat\.?\s*/gi, '')
    .replace(/\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const lyrics: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Show lyrics for the current track')
    .addStringOption((opt) =>
      opt.setName('search').setDescription('Search for a specific song instead').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const searchOverride = interaction.options.getString('search');
    let query: string;

    if (searchOverride) {
      query = searchOverride;
    } else {
      const queue = getQueues().get(interaction.guildId!);
      if (!queue?.currentTrack) {
        await interaction.reply({ content: 'Nothing is currently playing. Use `search:` to search manually.', ephemeral: true });
        return;
      }
      query = queue.currentTrack.title;
    }

    await interaction.deferReply();

    const cleaned = cleanTitle(query);

    try {
      // Try cleaned title first, fall back to original
      let results: LrcLibResult[] = [];
      for (const q of [cleaned, query]) {
        const res = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(q)}`);
        results = await res.json() as LrcLibResult[];
        if (results?.length && results[0]!.plainLyrics) break;
      }

      if (!results?.length || !results[0]!.plainLyrics) {
        await interaction.editReply(`No lyrics found for **${cleaned}**.`);
        return;
      }

      const hit    = results[0]!;
      let lyricsText = hit.plainLyrics!;
      if (lyricsText.length > 4000) lyricsText = lyricsText.slice(0, 3997) + '...';

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`${hit.trackName} - ${hit.artistName}`)
        .setDescription(lyricsText)
        .setFooter({ text: 'Lyrics from lrclib.net' });

      const hasAI = claudeAvailable() || geminiAvailable();

      if (hasAI) {
        const explainBtn = new ButtonBuilder()
          .setCustomId('lyrics_explain')
          .setLabel('Explain')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(explainBtn);

        const reply = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60_000,
          max: 1,
        });

        collector.on('collect', async (btnInteraction) => {
          try {
            await btnInteraction.deferReply();

            const prompt = `Analyze the meaning of these lyrics. Explain themes, metaphors, and cultural context in 2-3 paragraphs:\n\n<lyrics>${lyricsText}</lyrics>`;
            const result = await ask(
              interaction.guildId ?? 'dm',
              btnInteraction.user.id,
              prompt
            );

            const analysis = result.text.length > 1900 ? result.text.slice(0, 1897) + '...' : result.text;
            await btnInteraction.editReply({ content: analysis });
          } catch (err) {
            logger.error({ err }, 'lyrics explain failed');
            await btnInteraction.editReply('Could not generate lyrics analysis. Try again later.');
          }

          // Disable button after use
          explainBtn.setDisabled(true);
          await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => undefined);
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            // Timeout - disable button
            explainBtn.setDisabled(true);
            await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => undefined);
          }
        });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply('Could not fetch lyrics. Try again later.');
    }
  },
};

export default lyrics;
