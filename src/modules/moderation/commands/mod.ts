import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import ban from './ban';
import kick from './kick';
import mute from './mute';
import timeout from './timeout';
import unban from './unban';
import clear from './clear';
import nuke from './nuke';
import lockdown from './lockdown';
import slowmode from './slowmode';
import role from './role';
import caseCmd from './case';
import modlogs from './modlogs';
import warn from './warn';
import botrole from './botrole';
import antinuke from './antinuke';

const mod: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    // ── Simple subcommands ────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('ban').setDescription('Ban a user from the server (admin only)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
        .addStringOption((opt) =>
          opt.setName('delete_history').setDescription('Delete message history').setRequired(false)
            .addChoices(
              { name: 'None',       value: '0' },
              { name: 'Last hour',  value: '3600' },
              { name: 'Last 24h',   value: '86400' },
              { name: 'Last 7 days', value: '604800' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('kick').setDescription('Kick a user from the server (admin only)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for kick').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('mute').setDescription('Server mute a user in voice (admin only)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to mute').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('timeout').setDescription('Temporarily timeout a user (admin only)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to timeout').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('duration').setDescription('Duration').setRequired(true)
            .addChoices(
              { name: '1 minute',   value: '1m' },
              { name: '5 minutes',  value: '5m' },
              { name: '10 minutes', value: '10m' },
              { name: '30 minutes', value: '30m' },
              { name: '1 hour',     value: '1h' },
              { name: '6 hours',    value: '6h' },
              { name: '12 hours',   value: '12h' },
              { name: '1 day',      value: '1d' },
              { name: '7 days',     value: '7d' },
              { name: '28 days',    value: '28d' },
            )
        )
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('unban').setDescription('Unban a user (admin only)')
        .addStringOption((opt) => opt.setName('userid').setDescription('User ID to unban').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('Delete messages from this channel (admin only)')
        .addIntegerOption((opt) => opt.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('nuke').setDescription('Delete and recreate this channel (admin only)')
    )
    .addSubcommand((sub) =>
      sub.setName('lockdown').setDescription('Toggle channel lockdown (admin only)')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('slowmode').setDescription('Set channel slowmode (admin only)')
        .addIntegerOption((opt) => opt.setName('seconds').setDescription('Slowmode delay in seconds (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel (default: current)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('role').setDescription('Toggle a role on a user (admin only)')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to toggle').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('case').setDescription('View a specific moderation case')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('modlogs').setDescription('View moderation history for a user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to look up').setRequired(true))
    )
    // ── Subcommand groups (commands that have their own subcommands) ───────────
    .addSubcommandGroup((group) =>
      group.setName('warn').setDescription('Warn a user (admin only)')
        .addSubcommand((sub) =>
          sub.setName('add').setDescription('Issue a warning')
            .addUserOption((opt) => opt.setName('user').setDescription('User to warn').setRequired(true))
            .addStringOption((opt) => opt.setName('reason').setDescription('Warning reason').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('View warnings for a user')
            .addUserOption((opt) => opt.setName('user').setDescription('User to check').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('clear').setDescription('Clear all warnings for a user')
            .addUserOption((opt) => opt.setName('user').setDescription('User to clear').setRequired(true))
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('botrole').setDescription('Manage roles that have full bot access')
        .addSubcommand((sub) =>
          sub.setName('add').setDescription('Grant a role full bot access')
            .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('remove').setDescription("Revoke a role's bot access")
            .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('Show all roles with bot access')
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('antinuke').setDescription('Configure anti-nuke protection (admin only)')
        .addSubcommand((sub) =>
          sub.setName('enable').setDescription('Enable or disable anti-nuke')
            .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('config').setDescription('Set thresholds and action')
            .addIntegerOption((opt) => opt.setName('bans').setDescription('Ban threshold (default 3)').setMinValue(1).setMaxValue(20))
            .addIntegerOption((opt) => opt.setName('kicks').setDescription('Kick threshold (default 3)').setMinValue(1).setMaxValue(20))
            .addIntegerOption((opt) => opt.setName('channels').setDescription('Channel delete threshold (default 2)').setMinValue(1).setMaxValue(10))
            .addIntegerOption((opt) => opt.setName('roles').setDescription('Role delete threshold (default 2)').setMinValue(1).setMaxValue(10))
            .addIntegerOption((opt) => opt.setName('window').setDescription('Time window in seconds (default 10)').setMinValue(3).setMaxValue(60))
            .addStringOption((opt) =>
              opt.setName('action').setDescription('Action to take on the offender')
                .addChoices(
                  { name: 'Strip roles', value: 'strip' },
                  { name: 'Kick',        value: 'kick' },
                  { name: 'Ban',         value: 'ban' },
                )
            )
        )
        .addSubcommand((sub) =>
          sub.setName('whitelist').setDescription('Add or remove a user from the whitelist')
            .addUserOption((opt) => opt.setName('user').setDescription('User to whitelist/un-whitelist').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('status').setDescription('View current anti-nuke configuration')
        )
        .addSubcommand((sub) =>
          sub.setName('logs').setDescription('View recent anti-nuke triggers')
        )
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // Group dispatch — these commands handle their own sub-routing via getSubcommand()
    if (group === 'warn')     return warn.execute(interaction);
    if (group === 'botrole')  return botrole.execute(interaction);
    if (group === 'antinuke') return antinuke.execute(interaction);

    // Root subcommand dispatch
    const handlers: Record<string, CommandDef> = {
      ban, kick, mute, timeout, unban, clear, nuke, lockdown, slowmode, role,
      case: caseCmd, modlogs,
    };
    await handlers[sub]?.execute(interaction);
  },
};

export default mod;
