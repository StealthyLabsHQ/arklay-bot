import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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

const userinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to inspect (default: yourself)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user') ?? interaction.user;
    // Force-fetch to get banner + accent color
    const fetched = await target.fetch(true).catch(() => target);
    const member = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || fetched.accentColor || 0x5865f2)
      .setAuthor({ name: member?.displayName ?? fetched.displayName, iconURL: fetched.displayAvatarURL() })
      .setThumbnail(fetched.displayAvatarURL({ size: 512 }));

    // Banner
    const bannerUrl = fetched.bannerURL({ size: 512 });
    if (bannerUrl) embed.setImage(bannerUrl);

    // Core info
    embed.addFields(
      { name: 'Username',        value: fetched.tag,                                                  inline: true },
      { name: 'ID',              value: `\`${target.id}\``,                                           inline: true },
      { name: 'Status',          value: statusEmoji(member?.presence?.status),                         inline: true },
      { name: 'Account created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>\n(<t:${Math.floor(target.createdTimestamp / 1000)}:R>)`, inline: true },
    );

    if (member) {
      embed.addFields(
        { name: 'Joined server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>\n(<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>)` : 'Unknown', inline: true },
      );

      // Boost
      if (member.premiumSince) {
        embed.addFields({
          name: 'Boosting since',
          value: `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>`,
          inline: true,
        });
      }

      // Nickname
      if (member.nickname) {
        embed.addFields({ name: 'Nickname', value: member.nickname, inline: true });
      }

      // Highest role
      const highestRole = member.roles.highest;
      if (highestRole.id !== interaction.guildId) {
        embed.addFields({ name: 'Highest role', value: `${highestRole}`, inline: true });
      }

      // Roles
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .map((r) => `${r}`);
      const roleDisplay = roles.length > 15
        ? roles.slice(0, 15).join(' ') + ` +${roles.length - 15} more`
        : roles.join(' ') || 'None';
      embed.addFields({ name: `Roles (${roles.length})`, value: roleDisplay });

      // Permissions highlights
      const perms: string[] = [];
      if (member.permissions.has('Administrator'))     perms.push('Administrator');
      if (member.permissions.has('ManageGuild'))       perms.push('Manage Server');
      if (member.permissions.has('ManageChannels'))    perms.push('Manage Channels');
      if (member.permissions.has('ManageRoles'))       perms.push('Manage Roles');
      if (member.permissions.has('BanMembers'))        perms.push('Ban Members');
      if (member.permissions.has('KickMembers'))       perms.push('Kick Members');
      if (member.permissions.has('ModerateMembers'))   perms.push('Timeout Members');
      if (perms.length > 0) {
        embed.addFields({ name: 'Key permissions', value: perms.join(', ') });
      }

      // Activity
      const activity = member.presence?.activities?.[0];
      if (activity) {
        const actText = activity.state ? `${activity.name} - ${activity.state}` : activity.name;
        embed.addFields({ name: 'Activity', value: actText, inline: true });
      }
    }

    // Badges
    const flags = fetched.flags?.bitfield ?? 0;
    const badgeStr = badgeEmojis(flags);
    if (badgeStr) embed.addFields({ name: 'Badges', value: badgeStr });

    // Bot tag
    if (fetched.bot) {
      embed.addFields({ name: 'Bot', value: 'Yes', inline: true });
    }

    embed.setFooter({ text: `Requested by ${interaction.user.displayName}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default userinfo;
