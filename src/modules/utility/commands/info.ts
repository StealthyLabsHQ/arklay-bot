import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import avatar from './avatar';
import banner from './banner';
import botinfo from './botinfo';
import color from './color';
import emoji from './emoji';
import invite from './invite';
import membercount from './membercount';
import ping from './ping';
import roleinfo from './roleinfo';
import userinfo from './userinfo';
import serverinfo from './serverinfo';
import channelinfo from './channelinfo';

const info: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('User, server & channel information')
    // ── Simple subcommands ────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('avatar').setDescription("Display a user's avatar in full size")
        .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('banner').setDescription("Display a user's banner")
        .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('botinfo').setDescription('Learn about this bot')
    )
    .addSubcommand((sub) =>
      sub.setName('color').setDescription('Preview a color from its hex code')
        .addStringOption((opt) => opt.setName('hex').setDescription('Hex color code (e.g. #ff5700)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('emoji').setDescription('Get info and full-size image of an emoji or sticker')
        .addStringOption((opt) => opt.setName('emoji').setDescription('Emoji or sticker').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('invite').setDescription('Get the bot invite link')
    )
    .addSubcommand((sub) =>
      sub.setName('membercount').setDescription('Show the server member count')
    )
    .addSubcommand((sub) =>
      sub.setName('ping').setDescription('Show bot latency')
    )
    .addSubcommand((sub) =>
      sub.setName('roleinfo').setDescription('Display information about a role')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to inspect').setRequired(true))
    )
    // ── Subcommand groups (already have sub-actions) ──────────────────────────
    .addSubcommandGroup((group) =>
      group.setName('userinfo').setDescription('User information')
        .addSubcommand((sub) =>
          sub.setName('info').setDescription('Display information about a user')
            .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName('permissions').setDescription('View permissions of a user in this server')
            .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName('joinposition').setDescription('See the join position of a user in the server')
            .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false))
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('serverinfo').setDescription('Server information')
        .addSubcommand((sub) =>
          sub.setName('info').setDescription('Display server information')
        )
        .addSubcommand((sub) =>
          sub.setName('icon').setDescription('Display the server icon and banner in full resolution')
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('channelinfo').setDescription('Channel information')
        .addSubcommand((sub) =>
          sub.setName('info').setDescription('Display information about a channel')
            .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName('firstmessage').setDescription('Get a link to the first message in a channel')
            .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
        )
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // Group dispatch — these handle their own sub-routing via getSubcommand()
    if (group === 'userinfo')    return userinfo.execute(interaction);
    if (group === 'serverinfo')  return serverinfo.execute(interaction);
    if (group === 'channelinfo') return channelinfo.execute(interaction);

    // Root subcommand dispatch
    const handlers: Record<string, CommandDef> = {
      avatar, banner, botinfo, color, emoji, invite, membercount, ping, roleinfo,
    };
    await handlers[sub]?.execute(interaction);
  },
};

export default info;
