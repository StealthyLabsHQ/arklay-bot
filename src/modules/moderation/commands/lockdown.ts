import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const lockdown: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Toggle channel lockdown (admin only)')
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Channel to lock (default: current)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for lockdown').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    const reason  = interaction.options.getString('reason') ?? 'No reason provided';

    if (!('permissionOverwrites' in channel)) {
      await interaction.reply({ content: 'This command only works in text channels.', ephemeral: true });
      return;
    }

    const everyone   = interaction.guild!.roles.everyone;
    const overwrite   = channel.permissionOverwrites.cache.get(everyone.id);
    const isLocked    = overwrite?.deny.has(PermissionsBitField.Flags.SendMessages) ?? false;

    if (isLocked) {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Lockdown Lifted')
        .setDescription(`${channel} is now unlocked.`)
        .setFooter({ text: `By ${interaction.user.username}` });
      await interaction.reply({ embeds: [embed] });
    } else {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Channel Locked')
        .setDescription(`${channel} is now locked.\n**Reason:** ${reason}`)
        .setFooter({ text: `By ${interaction.user.username}` });
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default lockdown;
