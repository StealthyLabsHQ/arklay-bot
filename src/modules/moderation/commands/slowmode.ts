import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const slowmode: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode (admin only)')
    .addIntegerOption((opt) =>
      opt
        .setName('seconds')
        .setDescription('Slowmode delay in seconds (0 to disable)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Target channel (default: current)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const seconds = interaction.options.getInteger('seconds', true);
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;

    if (!('setRateLimitPerUser' in channel)) {
      await interaction.reply({ content: 'This command only works in text channels.', ephemeral: true });
      return;
    }

    await channel.setRateLimitPerUser(seconds);

    const embed = new EmbedBuilder()
      .setColor(seconds > 0 ? 0xfee75c : 0x57f287)
      .setTitle(seconds > 0 ? 'Slowmode Enabled' : 'Slowmode Disabled')
      .setDescription(seconds > 0 ? `${channel} - **${seconds}s** delay between messages.` : `Slowmode disabled in ${channel}.`)
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default slowmode;
