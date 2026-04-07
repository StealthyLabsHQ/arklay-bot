import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, VoiceChannel } from 'discord.js';
import type { CommandDef } from '../../../types';

const channelinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Channel information')
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Display information about a channel')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('firstmessage').setDescription('Get a link to the first message in a channel')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'firstmessage') {
      await interaction.deferReply({ ephemeral: true });
      const raw     = interaction.options.getChannel('channel') ?? interaction.channel;
      const channel = interaction.guild!.channels.cache.get(raw!.id) as TextChannel | null;
      if (!channel?.isTextBased()) { await interaction.editReply('Invalid channel.'); return; }

      const messages = await channel.messages.fetch({ limit: 1, after: '0' }).catch(() => null);
      const msg      = messages?.first();
      if (!msg) { await interaction.editReply('Could not fetch the first message.'); return; }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`First message in #${channel.name}`)
        .setDescription(`[Jump to message](${msg.url})`)
        .addFields(
          { name: 'Author',  value: `${msg.author}`, inline: true },
          { name: 'Date',    value: `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Content', value: msg.content ? msg.content.slice(0, 200) : '*No text content*' },
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // sub === 'info'
    const raw     = interaction.options.getChannel('channel') ?? interaction.channel;
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
        { name: 'ID',      value: channel.id,                                          inline: true },
        { name: 'Type',    value: typeNames[channel.type] ?? `${channel.type}`,         inline: true },
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
