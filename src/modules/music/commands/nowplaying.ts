import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { formatDuration } from '../structures/GuildQueue';

function progressBar(elapsed: number, total: number, width = 20): string {
  if (total === 0) return '░'.repeat(width);
  const ratio = Math.min(elapsed / total, 1);
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

const nowplaying: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.currentTrack) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    const track = queue.currentTrack;
    const elapsed = queue.getPlaybackDuration();
    const total = track.duration ?? 0;

    const bar = progressBar(elapsed, total);
    const elapsedFmt = formatDuration(elapsed);
    const totalFmt = track.durationStr;

    const loopLabel =
      queue.loopMode === 'track' ? ' 🔂' : queue.loopMode === 'queue' ? ' 🔁' : '';

    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle(`Now Playing${loopLabel}`)
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Progress', value: `\`${bar}\` ${elapsedFmt} / ${totalFmt}`, inline: false },
        { name: 'Volume', value: `${queue.volume}%`, inline: true },
        { name: 'Requested by', value: track.requestedBy, inline: true },
        { name: 'In queue', value: `${queue.tracks.length} track(s)`, inline: true }
      )
      .setThumbnail(track.thumbnail ?? null);

    await interaction.reply({ embeds: [embed] });
  },
};

export default nowplaying;
