import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const filter: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply an audio filter to the current track')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Filter to apply')
        .setRequired(true)
        .addChoices(
          { name: 'None (reset)',       value: 'none' },
          { name: 'Bass Boost',         value: 'bassboost' },
          { name: 'Nightcore',          value: 'nightcore' },
          { name: 'Vaporwave',          value: 'vaporwave' },
          { name: '8D Audio',           value: '8d' },
          { name: 'Slowed + Reverb',    value: 'slowed_reverb' },
          { name: 'Speed Up + Reverb',  value: 'speed_reverb' },
          { name: 'Treble Boost',       value: 'treble' },
          { name: 'Karaoke (vocal cut)',value: 'karaoke' },
          { name: 'Deep Bass',          value: 'deepbass' },
          { name: 'Chipmunk',           value: 'chipmunk' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.currentTrack || !queue.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    let type = interaction.options.getString('type', true);

    // Fuzzy match for text prefix commands (e.g. "arklay filter slowed" → "slowed_reverb")
    const VALID_FILTERS = ['none', 'bassboost', 'nightcore', 'vaporwave', '8d', 'slowed_reverb', 'speed_reverb', 'treble', 'karaoke', 'deepbass', 'chipmunk'];
    if (!VALID_FILTERS.includes(type)) {
      const lower = type.toLowerCase();
      const match = VALID_FILTERS.find((f) => f.includes(lower) || lower.includes(f));
      if (match) {
        type = match;
      } else {
        await interaction.reply({ content: `Unknown filter: \`${type}\`. Available: ${VALID_FILTERS.join(', ')}`, ephemeral: true });
        return;
      }
    }

    try {
      await queue.setFilter(type);
      const label = type === 'none' ? 'Filters cleared' : `Filter: **${type}**`;
      await interaction.reply(label);
    } catch {
      await interaction.reply({ content: 'Could not apply filter. Try again.', ephemeral: true });
    }
  },
};

export default filter;
