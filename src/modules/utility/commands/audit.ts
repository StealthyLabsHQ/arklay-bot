import { SlashCommandBuilder, EmbedBuilder, AuditLogEvent } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';

const ACTION_LABEL: Partial<Record<number, string>> = {
  [AuditLogEvent.MemberBanAdd]:    'Ban',
  [AuditLogEvent.MemberBanRemove]: 'Unban',
  [AuditLogEvent.MemberKick]:      'Kick',
  [AuditLogEvent.MemberUpdate]:    'Member Update',
  [AuditLogEvent.ChannelCreate]:   'Channel Create',
  [AuditLogEvent.ChannelDelete]:   'Channel Delete',
  [AuditLogEvent.ChannelUpdate]:   'Channel Update',
  [AuditLogEvent.RoleCreate]:      'Role Create',
  [AuditLogEvent.RoleDelete]:      'Role Delete',
  [AuditLogEvent.RoleUpdate]:      'Role Update',
  [AuditLogEvent.MessageDelete]:   'Message Delete',
  [AuditLogEvent.GuildUpdate]:     'Server Update',
  [AuditLogEvent.WebhookCreate]:   'Webhook Create',
  [AuditLogEvent.WebhookDelete]:   'Webhook Delete',
  [AuditLogEvent.EmojiCreate]:     'Emoji Create',
  [AuditLogEvent.EmojiDelete]:     'Emoji Delete',
};

const audit: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('View recent audit log entries (admin only)')
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('Number of entries (1-15, default 10)').setMinValue(1).setMaxValue(15)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const limit = interaction.options.getInteger('limit') ?? 10;
    const logs  = await interaction.guild!.fetchAuditLogs({ limit }).catch(() => null);

    if (!logs || logs.entries.size === 0) {
      await interaction.editReply('No audit log entries found.');
      return;
    }

    const lines = logs.entries.map((entry) => {
      const action = ACTION_LABEL[entry.action as number] ?? `Action #${entry.action}`;
      const target = entry.target && 'tag' in entry.target ? entry.target.tag : entry.targetId ?? '?';
      const ts     = Math.floor(entry.createdTimestamp / 1000);
      return `**${action}** — \`${target}\` — by <@${entry.executor?.id ?? '?'}> <t:${ts}:R>`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Audit Log')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${logs.entries.size} entries` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default audit;
