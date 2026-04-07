import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const move: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue')
    .addIntegerOption((opt) =>
      opt.setName('from').setDescription('Current position of the track').setMinValue(1).setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('to').setDescription('New position for the track').setMinValue(1).setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue || queue.tracks.length === 0) {
      await interaction.reply({ content: 'The queue is empty.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    const from = interaction.options.getInteger('from', true) - 1;
    const to = interaction.options.getInteger('to', true) - 1;

    if (from === to) {
      await interaction.reply({ content: 'Positions are the same.', ephemeral: true });
      return;
    }

    const trackName = queue.tracks[from]?.title;
    if (!trackName) {
      await interaction.reply({ content: `Invalid position. Queue has ${queue.tracks.length} tracks.`, ephemeral: true });
      return;
    }

    const ok = queue.moveTrack(from, to);
    if (!ok) {
      await interaction.reply({ content: `Invalid position. Queue has ${queue.tracks.length} tracks.`, ephemeral: true });
      return;
    }

    await interaction.reply(`Moved **${trackName}** from position ${from + 1} to ${to + 1}.`);
  },
};

export default move;
