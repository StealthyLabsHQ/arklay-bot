import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { getCase } from '../../../services/modcases';

const ACTION_COLOR: Record<string, number> = {
  warn:    0xfee75c,
  ban:     0xed4245,
  kick:    0xed4245,
  timeout: 0xffa500,
  unban:   0x57f287,
};

const caseCmd: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View a specific moderation case (admin only)')
    .addIntegerOption((opt) =>
      opt.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const caseId  = interaction.options.getInteger('id', true);
    const guildId = interaction.guildId!;
    const c       = getCase(guildId, caseId);

    if (!c) {
      await interaction.reply({ content: `Case #${caseId} not found.`, ephemeral: true });
      return;
    }

    const extra = c.extra ? ` (${c.extra})` : '';

    const embed = new EmbedBuilder()
      .setColor(ACTION_COLOR[c.action] ?? 0x5865f2)
      .setTitle(`Case #${c.id} — ${c.action.toUpperCase()}${extra}`)
      .addFields(
        { name: 'User',      value: `<@${c.user_id}>`,      inline: true },
        { name: 'Moderator', value: `<@${c.moderator_id}>`, inline: true },
        { name: 'Date',      value: `<t:${Math.floor(c.timestamp / 1000)}:F>`, inline: true },
        { name: 'Reason',    value: c.reason },
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default caseCmd;
