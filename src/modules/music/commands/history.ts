import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const history: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show recently played tracks') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);
    if (!queue || queue.history.length === 0) {
      await interaction.reply({ content: 'No playback history yet.', ephemeral: true });
      return;
    }

    const items = queue.history.slice(0, 20);
    const list = items.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) \`${t.durationStr}\``).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('Recently Played')
      .setDescription(list)
      .setFooter({ text: `${queue.history.length} tracks in history` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default history;
