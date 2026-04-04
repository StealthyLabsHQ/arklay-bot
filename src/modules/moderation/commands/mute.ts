import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const mute: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Server mute/unmute a user in voice (admin only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to mute/unmute').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const target = interaction.options.getMember('user') as GuildMember | null;

    if (!target) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!target.voice.channel) {
      await interaction.reply({ content: 'This user is not in a voice channel.', ephemeral: true });
      return;
    }

    const newState = !target.voice.serverMute;
    await target.voice.setMute(newState);

    const embed = new EmbedBuilder()
      .setColor(newState ? 0xed4245 : 0x57f287)
      .setTitle(newState ? 'User Muted' : 'User Unmuted')
      .setDescription(`${target} has been ${newState ? 'server muted' : 'unmuted'} in ${target.voice.channel}.`)
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default mute;
