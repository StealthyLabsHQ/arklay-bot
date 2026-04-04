import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, VoiceChannel } from 'discord.js';
import type { CommandDef } from '../../../types';

const channelinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Display information about a channel')
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const raw = interaction.options.getChannel('channel') ?? interaction.channel;
    const channel = interaction.guild!.channels.cache.get(raw!.id)!;

    const typeNames: Record<number, string> = {
      [ChannelType.GuildText]: 'Text', [ChannelType.GuildVoice]: 'Voice',
      [ChannelType.GuildCategory]: 'Category', [ChannelType.GuildAnnouncement]: 'Announcement',
      [ChannelType.GuildStageVoice]: 'Stage', [ChannelType.GuildForum]: 'Forum',
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`#${channel.name}`)
      .addFields(
        { name: 'ID',      value: channel.id,                                  inline: true },
        { name: 'Type',    value: typeNames[channel.type] ?? `${channel.type}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp! / 1000)}:R>`, inline: true },
      );

    if ('topic' in channel && (channel as TextChannel).topic) {
      embed.addFields({ name: 'Topic', value: (channel as TextChannel).topic! });
    }
    if ('rateLimitPerUser' in channel) {
      embed.addFields({ name: 'Slowmode', value: `${(channel as TextChannel).rateLimitPerUser}s`, inline: true });
    }
    if ('bitrate' in channel) {
      embed.addFields({ name: 'Bitrate', value: `${(channel as VoiceChannel).bitrate / 1000}kbps`, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default channelinfo;
