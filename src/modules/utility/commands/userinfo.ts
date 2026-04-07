import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, PresenceStatus } from 'discord.js';
import type { CommandDef } from '../../../types';

function statusEmoji(status: PresenceStatus | undefined): string {
  switch (status) {
    case 'online':  return '\uD83D\uDFE2 Online';
    case 'idle':    return '\uD83D\uDFE1 Idle';
    case 'dnd':     return '\uD83D\uDD34 Do Not Disturb';
    default:        return '\u26AB Offline';
  }
}

function badgeEmojis(flags: number): string {
  const badges: string[] = [];
  if (flags & (1 << 0))  badges.push('Discord Staff');
  if (flags & (1 << 1))  badges.push('Partner');
  if (flags & (1 << 2))  badges.push('HypeSquad Events');
  if (flags & (1 << 6))  badges.push('HypeSquad Bravery');
  if (flags & (1 << 7))  badges.push('HypeSquad Brilliance');
  if (flags & (1 << 8))  badges.push('HypeSquad Balance');
  if (flags & (1 << 9))  badges.push('Early Supporter');
  if (flags & (1 << 14)) badges.push('Bug Hunter Lv1');
  if (flags & (1 << 17)) badges.push('Early Verified Bot Dev');
  if (flags & (1 << 22)) badges.push('Active Developer');
  return badges.length > 0 ? badges.join(', ') : '';
}

const PERM_NAMES: Partial<Record<keyof typeof PermissionsBitField.Flags, string>> = {
  Administrator: 'Administrator', ManageGuild: 'Manage Server', ManageRoles: 'Manage Roles',
  ManageChannels: 'Manage Channels', KickMembers: 'Kick Members', BanMembers: 'Ban Members',
  ModerateMembers: 'Timeout Members', ManageMessages: 'Manage Messages', MentionEveryone: 'Mention Everyone',
  ManageWebhooks: 'Manage Webhooks', ManageNicknames: 'Manage Nicknames', ViewAuditLog: 'View Audit Log',
  SendMessages: 'Send Messages', EmbedLinks: 'Embed Links', AttachFiles: 'Attach Files',
  MoveMembers: 'Move Members', MuteMembers: 'Mute Members', DeafenMembers: 'Deafen Members',
  ManageGuildExpressions: 'Manage Emojis & Stickers', ManageEvents: 'Manage Events',
};

const userinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('User information')
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Display information about a user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to inspect (default: yourself)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('permissions').setDescription('View permissions of a user in this server')
        .addUserOption((opt) => opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('joinposition').setDescription('See the join position of a user in the server')
        .addUserOption((opt) => opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'permissions') {
      const target = (interaction.options.getMember('user') ?? interaction.member) as GuildMember | null;
      if (!target) { await interaction.reply({ content: 'User not found.', ephemeral: true }); return; }

      const perms   = target.permissions;
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
      return;
    }

    if (sub === 'joinposition') {
      await interaction.deferReply();
      const guild  = interaction.guild!;
      const target = (interaction.options.getMember('user') ?? interaction.member) as GuildMember | null;
      if (!target) { await interaction.editReply('User not found.'); return; }

      await guild.members.fetch();
      const sorted   = guild.members.cache.filter((m) => m.joinedTimestamp !== null).sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
      const position = [...sorted.keys()].indexOf(target.id) + 1;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Join position — ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: 'Position', value: `**#${position}** of ${guild.memberCount}`, inline: true },
          { name: 'Joined',   value: target.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>` : 'Unknown', inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // sub === 'info'
    const target  = interaction.options.getUser('user') ?? interaction.user;
    const fetched = await target.fetch(true).catch(() => target);
    const member  = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || fetched.accentColor || 0x5865f2)
      .setAuthor({ name: member?.displayName ?? fetched.displayName, iconURL: fetched.displayAvatarURL() })
      .setThumbnail(fetched.displayAvatarURL({ size: 512 }));

    const bannerUrl = fetched.bannerURL({ size: 512 });
    if (bannerUrl) embed.setImage(bannerUrl);

    embed.addFields(
      { name: 'Username',        value: fetched.tag,                                                      inline: true },
      { name: 'ID',              value: `\`${target.id}\``,                                               inline: true },
      { name: 'Status',          value: statusEmoji(member?.presence?.status),                             inline: true },
      { name: 'Account created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>\n(<t:${Math.floor(target.createdTimestamp / 1000)}:R>)`, inline: true },
    );

    if (member) {
      embed.addFields({ name: 'Joined server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>\n(<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>)` : 'Unknown', inline: true });
      if (member.premiumSince) embed.addFields({ name: 'Boosting since', value: `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>`, inline: true });
      if (member.nickname) embed.addFields({ name: 'Nickname', value: member.nickname, inline: true });
      const highestRole = member.roles.highest;
      if (highestRole.id !== interaction.guildId) embed.addFields({ name: 'Highest role', value: `${highestRole}`, inline: true });

      const roles = member.roles.cache.filter((r) => r.id !== interaction.guildId).sort((a, b) => b.position - a.position).map((r) => `${r}`);
      const roleDisplay = roles.length > 15 ? roles.slice(0, 15).join(' ') + ` +${roles.length - 15} more` : roles.join(' ') || 'None';
      embed.addFields({ name: `Roles (${roles.length})`, value: roleDisplay });

      const perms: string[] = [];
      if (member.permissions.has('Administrator'))   perms.push('Administrator');
      if (member.permissions.has('ManageGuild'))     perms.push('Manage Server');
      if (member.permissions.has('ManageChannels'))  perms.push('Manage Channels');
      if (member.permissions.has('ManageRoles'))     perms.push('Manage Roles');
      if (member.permissions.has('BanMembers'))      perms.push('Ban Members');
      if (member.permissions.has('KickMembers'))     perms.push('Kick Members');
      if (member.permissions.has('ModerateMembers')) perms.push('Timeout Members');
      if (perms.length > 0) embed.addFields({ name: 'Key permissions', value: perms.join(', ') });

      const activity = member.presence?.activities?.[0];
      if (activity) {
        const actText = activity.state ? `${activity.name} - ${activity.state}` : activity.name;
        embed.addFields({ name: 'Activity', value: actText, inline: true });
      }
    }

    const flags    = fetched.flags?.bitfield ?? 0;
    const badgeStr = badgeEmojis(flags);
    if (badgeStr) embed.addFields({ name: 'Badges', value: badgeStr });
    if (fetched.bot) embed.addFields({ name: 'Bot', value: 'Yes', inline: true });

    embed.setFooter({ text: `Requested by ${interaction.user.displayName}` }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export default userinfo;
