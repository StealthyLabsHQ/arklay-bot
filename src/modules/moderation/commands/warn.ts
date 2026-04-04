import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { addWarning, getWarnings, clearWarnings } from '../../../services/warnings';

const warn: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user (admin only)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Issue a warning')
        .addUserOption((opt) => opt.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Warning reason').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('View warnings for a user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to check').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Clear all warnings for a user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to clear').setRequired(true))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const sub    = interaction.options.getSubcommand();
    const user   = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;

    if (sub === 'add') {
      const reason   = interaction.options.getString('reason', true);
      const warnings = addWarning(guildId, user.id, reason, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('Warning Issued')
        .addFields(
          { name: 'User',          value: `${user}`, inline: true },
          { name: 'Total warnings', value: `${warnings.length}`, inline: true },
          { name: 'Reason',        value: reason },
        )
        .setFooter({ text: `By ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'list') {
      const warnings = getWarnings(guildId, user.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Warnings - ${user.tag}`)
        .setDescription(
          warnings.length === 0
            ? 'No warnings.'
            : warnings
                .map((w, i) => `**${i + 1}.** ${w.reason} - <@${w.moderatorId}> <t:${Math.floor(w.timestamp / 1000)}:R>`)
                .join('\n')
        )
        .setFooter({ text: `${warnings.length} warning${warnings.length !== 1 ? 's' : ''} total` });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else {
      const count = clearWarnings(guildId, user.id);
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Warnings Cleared')
        .setDescription(`Cleared **${count}** warning${count !== 1 ? 's' : ''} for ${user}.`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default warn;
