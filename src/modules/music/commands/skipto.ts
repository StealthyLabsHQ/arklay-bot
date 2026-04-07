import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const skipto: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('skipto')
    .setDescription('Skip to a specific track in the queue')
    .addIntegerOption((opt) =>
      opt
        .setName('position')
        .setDescription('Position in the queue (e.g. 6 for track #6)')
        .setMinValue(1)
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue || !queue.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    const pos = interaction.options.getInteger('position', true);

    if (pos < 1 || pos > queue.tracks.length) {
      await interaction.reply({
        content: `Invalid position. Queue has ${queue.tracks.length} track${queue.tracks.length !== 1 ? 's' : ''}.`,
        ephemeral: true,
      });
      return;
    }

    // Remove all tracks before the target position
    const skipped = queue.tracks.splice(0, pos - 1);
    const target = queue.tracks[0];

    queue.persistState();
    queue.skip();

    await interaction.reply(`Skipped ${skipped.length} track${skipped.length !== 1 ? 's' : ''}, jumping to **${target?.title ?? 'next track'}**.`);
  },
};

export default skipto;
