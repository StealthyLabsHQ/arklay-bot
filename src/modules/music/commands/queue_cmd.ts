import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { queue } from './controls';
import shuffle from './shuffle';
import move from './move';
import remove from './remove';
import save from './save';
import lyrics from './lyrics';
import historyCmd from './history';
import favorites from './favorites';
import playlist from './playlist';

const queueCmd: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Queue management and track library')
    // ── Simple subcommands ────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('show').setDescription('Display the current queue')
    )
    .addSubcommand((sub) =>
      sub.setName('shuffle').setDescription('Shuffle the queue')
    )
    .addSubcommand((sub) =>
      sub.setName('move').setDescription('Move a track to a different position in the queue')
        .addIntegerOption((opt) => opt.setName('from').setDescription('Current position').setRequired(true).setMinValue(1))
        .addIntegerOption((opt) => opt.setName('to').setDescription('Target position').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove a track from the queue by position')
        .addIntegerOption((opt) => opt.setName('position').setDescription('Position to remove').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('save').setDescription('Save the current track to your DMs')
    )
    .addSubcommand((sub) =>
      sub.setName('lyrics').setDescription('Show lyrics for the current track')
        .addStringOption((opt) => opt.setName('search').setDescription('Override search query').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('history').setDescription('Show recently played tracks')
    )
    // ── Subcommand groups ─────────────────────────────────────────────────────
    .addSubcommandGroup((group) =>
      group.setName('favorites').setDescription('Manage your favorite tracks')
        .addSubcommand((sub) =>
          sub.setName('add').setDescription('Save the current track to favorites')
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('Show your saved favorites')
        )
        .addSubcommand((sub) =>
          sub.setName('play').setDescription('Play a favorite track or all favorites')
            .addIntegerOption((opt) => opt.setName('id').setDescription('Favorite ID to play (omit for all)').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName('remove').setDescription('Remove a track from favorites')
            .addIntegerOption((opt) => opt.setName('id').setDescription('Favorite ID to remove').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('clear').setDescription('Clear all favorites')
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('playlist').setDescription('Manage personal playlists')
        .addSubcommand((sub) =>
          sub.setName('create').setDescription('Create a new playlist')
            .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('save').setDescription('Save the current queue as a playlist')
            .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('List your playlists')
        )
        .addSubcommand((sub) =>
          sub.setName('load').setDescription('Load a playlist into the queue')
            .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('show').setDescription('Show tracks in a playlist')
            .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('delete').setDescription('Delete a playlist')
            .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
        )
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // Group dispatch — these handle their own sub-routing via getSubcommand()
    if (group === 'favorites') return favorites.execute(interaction);
    if (group === 'playlist')  return playlist.execute(interaction);

    // Root subcommand dispatch
    const handlers: Record<string, CommandDef> = {
      show: queue, shuffle, move, remove, save, lyrics, history: historyCmd,
    };
    await handlers[sub]?.execute(interaction);
  },
};

export default queueCmd;
