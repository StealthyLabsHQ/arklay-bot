import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const nuke: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Delete and recreate a channel (admin only)') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const channel = interaction.channel as TextChannel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'This command only works in text channels.', ephemeral: true });
      return;
    }

    await interaction.reply('Nuking this channel...');

    const newChannel = await channel.clone({ reason: `Nuked by ${interaction.user.username}` });
    if (channel.parent) await newChannel.setParent(channel.parent.id);
    await newChannel.setPosition(channel.position);
    await channel.delete(`Nuked by ${interaction.user.username}`);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Channel Nuked')
      .setDescription(`This channel was nuked by ${interaction.user}.`)
      .setTimestamp();

    await newChannel.send({ embeds: [embed] });
  },
};

export default nuke;
