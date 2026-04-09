import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import play from './play';
import { pause, resume, skip, stop } from './controls';
import nowplaying from './nowplaying';
import loop from './loop';
import volume from './volume';
import seek from './seek';
import filter from './filter';
import skipto from './skipto';
import replay from './replay';
import previous from './previous';
import autoplay from './autoplay';
import twentyfourseven from './twentyfourseven';
import stats from './stats';

const musicCmd: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music playback commands')
    .addSubcommand((sub) =>
      sub.setName('play').setDescription('Add a track or playlist to the queue')
        .addStringOption((opt) => opt.setName('query').setDescription('Song name, URL or playlist link').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('pause').setDescription('Pause the current track')
    )
    .addSubcommand((sub) =>
      sub.setName('resume').setDescription('Resume playback')
    )
    .addSubcommand((sub) =>
      sub.setName('skip').setDescription('Skip to the next track')
    )
    .addSubcommand((sub) =>
      sub.setName('skipto').setDescription('Skip to a specific track in the queue')
        .addIntegerOption((opt) => opt.setName('position').setDescription('Track position to skip to').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('previous').setDescription('Play the previous track again')
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Stop playback and clear the queue')
    )
    .addSubcommand((sub) =>
      sub.setName('nowplaying').setDescription('Show the currently playing track')
    )
    .addSubcommand((sub) =>
      sub.setName('replay').setDescription('Restart the current track from the beginning')
    )
    .addSubcommand((sub) =>
      sub.setName('loop').setDescription('Set the loop mode')
        .addStringOption((opt) =>
          opt.setName('mode').setDescription('Loop mode').setRequired(true)
            .addChoices(
              { name: 'Off',                       value: 'off' },
              { name: 'Track — repeat current',    value: 'track' },
              { name: 'Queue — repeat entire queue', value: 'queue' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('volume').setDescription('Adjust the playback volume')
        .addIntegerOption((opt) => opt.setName('level').setDescription('Volume level (0-100)').setRequired(true).setMinValue(0).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('seek').setDescription('Jump to a position in the current track')
        .addStringOption((opt) => opt.setName('position').setDescription('Position (e.g. 1:30 or 90)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('filter').setDescription('Apply an audio filter to the current track')
        .addStringOption((opt) =>
          opt.setName('type').setDescription('Filter to apply').setRequired(true)
            .addChoices(
              { name: 'None (reset)',          value: 'none' },
              { name: 'Bass Boost',            value: 'bassboost' },
              { name: 'Nightcore',             value: 'nightcore' },
              { name: 'Vaporwave',             value: 'vaporwave' },
              { name: '8D Audio',              value: '8d' },
              { name: 'Slowed + Reverb',       value: 'slowed_reverb' },
              { name: 'Speed Up + Reverb',     value: 'speed_reverb' },
              { name: 'Treble Boost',          value: 'treble' },
              { name: 'Karaoke (vocal cut)',   value: 'karaoke' },
              { name: 'Deep Bass',             value: 'deepbass' },
              { name: 'Chipmunk',              value: 'chipmunk' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('autoplay').setDescription('Toggle autoplay — automatically add similar tracks when queue ends')
    )
    .addSubcommand((sub) =>
      sub.setName('twentyfourseven').setDescription('Toggle 24/7 mode — bot stays in voice channel')
    )
    .addSubcommand((sub) =>
      sub.setName('stats').setDescription('Show music statistics for this server')
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const handlers: Record<string, CommandDef> = {
      play, pause, resume, skip, skipto, previous, stop,
      nowplaying, replay, loop, volume, seek, filter,
      autoplay, twentyfourseven, stats,
    };
    await handlers[sub]?.execute(interaction);
  },
};

export default musicCmd;
