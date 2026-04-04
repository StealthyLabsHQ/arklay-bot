import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

const disconnect: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from the voice channel') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = getQueues().get(interaction.guildId!);

    if (!queue?.connection) {
      await interaction.reply({ content: 'The bot is not in a voice channel.', ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    const botChannelId = (queue.connection as unknown as { joinConfig: { channelId: string } })
      .joinConfig.channelId;

    if (member.voice.channelId !== botChannelId) {
      await interaction.reply({
        content: 'You must be in the same voice channel as the bot.',
        ephemeral: true,
      });
      return;
    }

    queue.destroy();
    getQueues().delete(interaction.guildId!);
    await interaction.reply('Disconnected.');
  },
};

export default disconnect;
