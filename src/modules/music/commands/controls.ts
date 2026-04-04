import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import type { Track } from '../structures/GuildQueue';
import { formatDuration } from '../structures/GuildQueue';
import { getQueues } from '../../../services/musicQueue';

function getQueue(interaction: ChatInputCommandInteraction) {
  return getQueues().get(interaction.guildId!);
}

/** Returns true if the user is in the same voice channel as the bot (or the bot is not connected). */
function isInBotVoice(interaction: ChatInputCommandInteraction): boolean {
  const queue = getQueue(interaction);
  if (!queue?.connection) return true; // bot not connected - allow
  const member = interaction.member as GuildMember;
  const userChannelId = member.voice.channelId;
  const botChannelId = (queue.connection as unknown as { joinConfig: { channelId: string } }).joinConfig
    .channelId;
  return userChannelId === botChannelId;
}

export const pause: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(interaction);
    if (!queue?.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }
    const ok = queue.pause();
    await interaction.reply(ok ? 'Paused.' : 'Could not pause.');
  },
};

export const resume: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueue(interaction);
    if (!queue) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }
    const ok = queue.resume();
    await interaction.reply(ok ? 'Resumed.' : 'Could not resume.');
  },
};

export const skip: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip to the next track') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isInBotVoice(interaction)) {
      await interaction.reply({
        content: 'You must be in the same voice channel as the bot.',
        ephemeral: true,
      });
      return;
    }
    const queue = getQueue(interaction);
    if (!queue?.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }
    queue.skip();
    await interaction.reply('Track skipped.');
  },
};

export const stop: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isInBotVoice(interaction)) {
      await interaction.reply({
        content: 'You must be in the same voice channel as the bot.',
        ephemeral: true,
      });
      return;
    }
    const queue = getQueue(interaction);
    if (!queue) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }
    queue.destroy();
    getQueues().delete(interaction.guildId!);
    await interaction.reply('Playback stopped, queue cleared.');
  },
};

const TRACKS_PER_PAGE = 10;

function buildQueuePage(currentTrack: Track | null, tracks: Track[], page: number): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(tracks.length / TRACKS_PER_PAGE));
  const start = page * TRACKS_PER_PAGE;
  const pageItems = tracks.slice(start, start + TRACKS_PER_PAGE);

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0)
    + (currentTrack?.duration ?? 0);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Queue - ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`)
    .setFooter({ text: `Page ${page + 1}/${totalPages} | Total duration: ${formatDuration(totalDuration)}` });

  if (currentTrack) {
    embed.addFields({
      name: '\u25B6 Now Playing',
      value: `[${currentTrack.title}](${currentTrack.url}) - ${currentTrack.durationStr}`,
    });
  }

  if (pageItems.length > 0) {
    const list = pageItems
      .map((t, i) => `**${start + i + 1}.** [${t.title}](${t.url}) - ${t.durationStr} (${t.requestedBy})`)
      .join('\n');
    // Truncate safely if a single page still exceeds 1024
    embed.addFields({ name: 'Up Next', value: list.length > 1000 ? list.slice(0, 997) + '...' : list });
  } else if (page === 0) {
    embed.addFields({ name: 'Up Next', value: 'No tracks in queue.' });
  }

  return embed;
}

function buildQueueButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_first')
      .setEmoji('\u23EE')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('queue_prev')
      .setEmoji('\u25C0')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('queue_page')
      .setLabel(`${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setEmoji('\u25B6')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('queue_last')
      .setEmoji('\u23ED')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

export const queue: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Display the current queue') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const q = getQueue(interaction);
    if (!q) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }

    let page = 0;
    const totalPages = Math.max(1, Math.ceil(q.tracks.length / TRACKS_PER_PAGE));

    const embed = buildQueuePage(q.currentTrack, q.tracks, page);
    const components = totalPages > 1 ? [buildQueueButtons(page, totalPages)] : [];

    const reply = await interaction.reply({ embeds: [embed], components, fetchReply: true });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: 'Only the command user can navigate.', ephemeral: true });
        return;
      }

      const currentTotal = Math.max(1, Math.ceil(q.tracks.length / TRACKS_PER_PAGE));
      if (btn.customId === 'queue_first') page = 0;
      else if (btn.customId === 'queue_prev') page = Math.max(0, page - 1);
      else if (btn.customId === 'queue_next') page = Math.min(currentTotal - 1, page + 1);
      else if (btn.customId === 'queue_last') page = currentTotal - 1;

      await btn.update({
        embeds: [buildQueuePage(q.currentTrack, q.tracks, page)],
        components: [buildQueueButtons(page, currentTotal)],
      });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  },
};
