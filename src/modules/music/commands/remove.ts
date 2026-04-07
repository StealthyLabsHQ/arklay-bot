import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const remove: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by its position')
    .addIntegerOption((opt) =>
      opt
        .setName('position')
        .setDescription('Position in the queue (use /queue to see positions)')
        .setMinValue(1)
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue || queue.tracks.length === 0) {
      await interaction.reply({ content: 'The queue is empty.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    const position = interaction.options.getInteger('position', true);
    const removed = queue.removeTrack(position - 1); // convert 1-based to 0-based

    if (!removed) {
      await interaction.reply({
        content: `Invalid position. The queue has ${queue.tracks.length} track(s).`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply(`Removed **${removed.title}** from position ${position}.`);
  },
};

export default remove;
