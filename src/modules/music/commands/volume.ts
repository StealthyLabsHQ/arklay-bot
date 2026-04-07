import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const volume: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjust the playback volume')
    .addIntegerOption((opt) =>
      opt
        .setName('level')
        .setDescription('Volume level (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue) {
      await interaction.reply({ content: 'No active queue.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    const level = interaction.options.getInteger('level', true);
    await queue.setVolume(level);

    const bar = '█'.repeat(Math.round(level / 10)) + '░'.repeat(10 - Math.round(level / 10));
    await interaction.reply(`Volume: \`${bar}\` **${level}%**`);
  },
};

export default volume;
