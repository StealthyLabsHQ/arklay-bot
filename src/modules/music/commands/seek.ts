import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { formatDuration } from '../structures/GuildQueue';

function parseTimestamp(input: string): number | null {
  // "1:30" or "90" or "1:02:30"
  const parts = input.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

const seek: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a position in the current track')
    .addStringOption((opt) =>
      opt.setName('position').setDescription('Timestamp (e.g. 1:30 or 90)').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.currentTrack || !queue.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    const input   = interaction.options.getString('position', true);
    const seconds = parseTimestamp(input);

    if (seconds === null || seconds < 0) {
      await interaction.reply({ content: 'Invalid timestamp. Use formats like `1:30` or `90`.', ephemeral: true });
      return;
    }

    if (queue.currentTrack.duration && seconds > queue.currentTrack.duration) {
      await interaction.reply({ content: `Track is only ${formatDuration(queue.currentTrack.duration)} long.`, ephemeral: true });
      return;
    }

    try {
      await queue.seekTo(seconds);
      await interaction.reply(`Seeked to **${formatDuration(seconds)}**.`);
    } catch {
      await interaction.reply({ content: 'Could not seek. Try again.', ephemeral: true });
    }
  },
};

export default seek;
