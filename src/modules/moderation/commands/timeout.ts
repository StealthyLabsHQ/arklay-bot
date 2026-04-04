import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const DURATION_MAP: Record<string, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '10m': 600_000,
  '30m': 1_800_000,
  '1h':  3_600_000,
  '6h':  21_600_000,
  '12h': 43_200_000,
  '1d':  86_400_000,
  '7d':  604_800_000,
  '28d': 2_419_200_000,
};

const timeout: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily mute a user (admin only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to timeout').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('duration')
        .setDescription('Timeout duration')
        .setRequired(true)
        .addChoices(
          { name: '1 minute',  value: '1m' },
          { name: '5 minutes', value: '5m' },
          { name: '10 minutes', value: '10m' },
          { name: '30 minutes', value: '30m' },
          { name: '1 hour',    value: '1h' },
          { name: '6 hours',   value: '6h' },
          { name: '12 hours',  value: '12h' },
          { name: '1 day',     value: '1d' },
          { name: '7 days',    value: '7d' },
          { name: '28 days',   value: '28d' },
        )
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for timeout').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const target   = interaction.options.getMember('user') as GuildMember | null;
    const duration = DURATION_MAP[interaction.options.getString('duration', true)]!;
    const reason   = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!target.moderatable) {
      await interaction.reply({ content: 'I cannot timeout this user (higher role or missing permissions).', ephemeral: true });
      return;
    }

    await target.timeout(duration, reason);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('User Timed Out')
      .addFields(
        { name: 'User',     value: `${target}`,   inline: true },
        { name: 'Duration', value: interaction.options.getString('duration', true), inline: true },
        { name: 'Reason',   value: reason },
      )
      .setFooter({ text: `By ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default timeout;
