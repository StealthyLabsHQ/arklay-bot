import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import type { LoopMode } from '../structures/GuildQueue';
import { getQueues } from '../../../services/musicQueue';

const loop: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track - repeat current track', value: 'track' },
          { name: 'Queue - repeat entire queue', value: 'queue' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.isPlaying) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    const mode = interaction.options.getString('mode', true) as LoopMode;
    queue.loopMode = mode;

    const labels: Record<LoopMode, string> = {
      off: 'Loop disabled.',
      track: 'Looping current track. 🔂',
      queue: 'Looping entire queue. 🔁',
    };

    await interaction.reply(labels[mode]);
  },
};

export default loop;
