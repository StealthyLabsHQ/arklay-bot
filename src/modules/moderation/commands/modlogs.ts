import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { getCases } from '../../../services/modcases';

const ACTION_EMOJI: Record<string, string> = {
  warn:    '⚠️',
  ban:     '🔨',
  kick:    '👢',
  timeout: '⏱️',
  unban:   '✅',
};

const modlogs: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View moderation history for a user (admin only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to check').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const user    = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const cases   = getCases(guildId, user.id);

    if (cases.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`Mod Logs — ${user.tag}`)
            .setDescription('No moderation history found.')
            .setThumbnail(user.displayAvatarURL()),
        ],
        ephemeral: true,
      });
      return;
    }

    const lines = cases.slice(0, 15).map((c) => {
      const emoji = ACTION_EMOJI[c.action] ?? '•';
      const extra = c.extra ? ` (${c.extra})` : '';
      return `**#${c.id}** ${emoji} \`${c.action}${extra}\` — ${c.reason}\n↳ <@${c.moderator_id}> • <t:${Math.floor(c.timestamp / 1000)}:R>`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Mod Logs — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${cases.length} total case${cases.length !== 1 ? 's' : ''}${cases.length > 15 ? ' (showing latest 15)' : ''}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default modlogs;
