import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const replay: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('replay')
    .setDescription('Restart the current track from the beginning') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue?.currentTrack || !queue.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    try {
      await queue.seekTo(0);
      await interaction.reply(`Replaying **${queue.currentTrack.title}** from the beginning.`);
    } catch {
      await interaction.reply({ content: 'Could not replay the track.', ephemeral: true });
    }
  },
};

export default replay;
