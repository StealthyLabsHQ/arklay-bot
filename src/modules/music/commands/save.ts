import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const save: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('save')
    .setDescription('Save the current track to your DMs') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.currentTrack) {
      await interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
      return;
    }

    const track = queue.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle('Saved Track')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Duration', value: track.durationStr, inline: true },
        { name: 'Source',   value: track.source,      inline: true },
      )
      .setFooter({ text: `From ${interaction.guild?.name ?? 'server'}` });
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({ content: 'Track info sent to your DMs!', ephemeral: true });
    } catch {
      await interaction.reply({ content: 'Could not send DM. Make sure your DMs are open.', ephemeral: true });
    }
  },
};

export default save;
