import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';

const firstmessage: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('firstmessage')
    .setDescription('Get a link to the first message in a channel')
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Channel to check (default: current)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply('Invalid channel.');
      return;
    }

    const messages = await (channel as TextChannel).messages.fetch({ limit: 1, after: '0' }).catch(() => null);
    const msg      = messages?.first();

    if (!msg) {
      await interaction.editReply('Could not fetch the first message.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`First message in #${channel.name}`)
      .setDescription(`[Jump to message](${msg.url})`)
      .addFields(
        { name: 'Author',  value: `${msg.author}`,                                      inline: true },
        { name: 'Date',    value: `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`,   inline: true },
        { name: 'Content', value: msg.content ? msg.content.slice(0, 200) : '*No text content*' },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default firstmessage;
