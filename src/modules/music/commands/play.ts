import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import { GuildQueue } from '../structures/GuildQueue';
import { resolve } from '../utils/resolver';
import { logger } from '../../../services/logger';
import { getQueues } from '../../../services/musicQueue';

const play: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Add a track or playlist to the queue')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('YouTube/Spotify/SoundCloud URL or text search')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const member       = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply('You must be in a voice channel.');
      return;
    }

    const query   = interaction.options.getString('query', true);
    const guildId = interaction.guildId!;

    let queue = getQueues().get(guildId);
    if (!queue) {
      queue = new GuildQueue(guildId, interaction.channel as TextChannel);
      getQueues().set(guildId, queue);
    }

    await queue.connect(voiceChannel, member);

    // Resolve track(s)
    let result;
    try {
      result = await resolve(query, `<@${interaction.user.id}>`);
    } catch (err) {
      logger.error({ err }, 'Resolver error');
      getQueues().delete(guildId);
      await interaction.editReply('No results found for this query.');
      return;
    }

    const { tracks, isPlaylist, playlistTitle } = result;

    const MAX_QUEUE_ADD = 50;
    const capped = tracks.slice(0, MAX_QUEUE_ADD);
    queue.tracks.push(...capped);

    if (capped.length < tracks.length) {
      const ch = interaction.channel;
      if (ch && 'send' in ch) {
        await (ch as TextChannel)
          .send(`Track limit of ${MAX_QUEUE_ADD} per command - ${tracks.length - capped.length} track(s) skipped.`)
          .catch(() => undefined);
      }
    }

    if (!queue.isPlaying) {
      queue.playNext().catch((err) => logger.error({ err }, 'playNext failed'));
    }

    // Reply
    if (isPlaylist) {
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`📋 ${playlistTitle ?? 'Playlist'}`)
        .setDescription(
          `**${capped.length}** track(s) added to the queue.\n` +
          (queue.currentTrack ? `▶ Now: **${queue.currentTrack.title}**` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` });
      await interaction.editReply({ embeds: [embed] });
    } else {
      const track = capped[0]!;
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(queue.currentTrack?.url === track.url ? 'Playing now' : 'Added to queue')
        .setDescription(`**[${track.title}](${track.url})**`)
        .addFields({ name: 'Duration', value: track.durationStr, inline: true })
        .setFooter({ text: `Requested by ${interaction.user.username}` });
      if (track.thumbnail) embed.setThumbnail(track.thumbnail);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default play;
