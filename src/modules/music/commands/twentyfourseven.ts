import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';
import { ensureSameVoiceAccess } from './controls';

const twentyfourseven: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode — bot stays in voice channel') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue) {
      await interaction.reply({ content: 'No active queue. Use `/play` first.', ephemeral: true });
      return;
    }

    if (!(await ensureSameVoiceAccess(interaction, queue))) return;

    const enabled = queue.toggleStayConnected();

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
        .setTitle('24/7 Mode')
        .setDescription(enabled
          ? '**Enabled** — bot will stay in the voice channel even when the queue is empty.'
          : '**Disabled** — bot will disconnect after idle timeout.')
      ],
    });
  },
};

export default twentyfourseven;
