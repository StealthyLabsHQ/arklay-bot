import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';

const PERM_NAMES: Partial<Record<keyof typeof PermissionsBitField.Flags, string>> = {
  Administrator:            'Administrator',
  ManageGuild:              'Manage Server',
  ManageRoles:              'Manage Roles',
  ManageChannels:           'Manage Channels',
  KickMembers:              'Kick Members',
  BanMembers:               'Ban Members',
  ModerateMembers:          'Timeout Members',
  ManageMessages:           'Manage Messages',
  MentionEveryone:          'Mention Everyone',
  ManageWebhooks:           'Manage Webhooks',
  ManageNicknames:          'Manage Nicknames',
  ViewAuditLog:             'View Audit Log',
  SendMessages:             'Send Messages',
  EmbedLinks:               'Embed Links',
  AttachFiles:              'Attach Files',
  MoveMembers:              'Move Members',
  MuteMembers:              'Mute Members',
  DeafenMembers:            'Deafen Members',
  ManageGuildExpressions:   'Manage Emojis & Stickers',
  ManageEvents:             'Manage Events',
  ManageThreads:            'Manage Threads',
};

const permissions: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('View permissions of a user in this server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = (interaction.options.getMember('user') ?? interaction.member) as GuildMember | null;
    if (!target) {
      await interaction.reply({ content: 'User not found.', ephemeral: true });
      return;
    }

    const perms = target.permissions;
    const isAdmin = perms.has(PermissionsBitField.Flags.Administrator);

    const granted: string[] = [];
    for (const [key, label] of Object.entries(PERM_NAMES)) {
      const flag = PermissionsBitField.Flags[key as keyof typeof PermissionsBitField.Flags];
      if (perms.has(flag)) granted.push(label);
    }

    const embed = new EmbedBuilder()
      .setColor(isAdmin ? 0xed4245 : 0x5865f2)
      .setTitle(`Permissions — ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription(isAdmin ? '**Administrator** — all permissions granted.' : (granted.length > 0 ? granted.map((p) => `+ ${p}`).join('\n') : 'No notable permissions.'))
      .setFooter({ text: `Roles: ${target.roles.cache.size - 1}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default permissions;
