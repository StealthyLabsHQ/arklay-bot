import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { getConfig, saveConfig, getLogs } from '../../../services/antinuke';

const antinuke: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure anti-nuke protection (admin only)')
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable or disable anti-nuke')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Set thresholds and action')
        .addIntegerOption((opt) => opt.setName('bans').setDescription('Ban threshold (default 3)').setMinValue(1).setMaxValue(20))
        .addIntegerOption((opt) => opt.setName('kicks').setDescription('Kick threshold (default 3)').setMinValue(1).setMaxValue(20))
        .addIntegerOption((opt) => opt.setName('channels').setDescription('Channel delete threshold (default 2)').setMinValue(1).setMaxValue(10))
        .addIntegerOption((opt) => opt.setName('roles').setDescription('Role delete threshold (default 2)').setMinValue(1).setMaxValue(10))
        .addIntegerOption((opt) => opt.setName('window').setDescription('Time window in seconds (default 10)').setMinValue(3).setMaxValue(60))
        .addStringOption((opt) =>
          opt.setName('action').setDescription('Action to take on the offender')
            .addChoices(
              { name: 'Strip roles', value: 'strip' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('whitelist')
        .setDescription('Add or remove a user from the whitelist')
        .addUserOption((opt) => opt.setName('user').setDescription('User to whitelist/un-whitelist').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('View current anti-nuke configuration')
    )
    .addSubcommand((sub) =>
      sub.setName('logs').setDescription('View recent anti-nuke triggers')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const cfg     = getConfig(guildId);

    if (sub === 'enable') {
      cfg.enabled = interaction.options.getBoolean('enabled', true);
      saveConfig(guildId, cfg);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(cfg.enabled ? 0x57f287 : 0xed4245).setDescription(`Anti-nuke **${cfg.enabled ? 'enabled' : 'disabled'}**.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'config') {
      if (interaction.options.getInteger('bans')) cfg.ban_threshold = interaction.options.getInteger('bans')!;
      if (interaction.options.getInteger('kicks')) cfg.kick_threshold = interaction.options.getInteger('kicks')!;
      if (interaction.options.getInteger('channels')) cfg.channel_threshold = interaction.options.getInteger('channels')!;
      if (interaction.options.getInteger('roles')) cfg.role_threshold = interaction.options.getInteger('roles')!;
      if (interaction.options.getInteger('window')) cfg.window_seconds = interaction.options.getInteger('window')!;
      if (interaction.options.getString('action')) cfg.action = interaction.options.getString('action') as typeof cfg.action;
      saveConfig(guildId, cfg);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Anti-nuke config updated')
            .addFields(
              { name: 'Ban threshold',     value: `${cfg.ban_threshold}`,     inline: true },
              { name: 'Kick threshold',    value: `${cfg.kick_threshold}`,    inline: true },
              { name: 'Channel threshold', value: `${cfg.channel_threshold}`, inline: true },
              { name: 'Role threshold',    value: `${cfg.role_threshold}`,    inline: true },
              { name: 'Window',            value: `${cfg.window_seconds}s`,   inline: true },
              { name: 'Action',            value: cfg.action,                 inline: true },
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'whitelist') {
      const user = interaction.options.getUser('user', true);
      const idx  = cfg.whitelist.indexOf(user.id);
      if (idx === -1) {
        cfg.whitelist.push(user.id);
        saveConfig(guildId, cfg);
        await interaction.reply({ content: `${user} added to the anti-nuke whitelist.`, ephemeral: true });
      } else {
        cfg.whitelist.splice(idx, 1);
        saveConfig(guildId, cfg);
        await interaction.reply({ content: `${user} removed from the anti-nuke whitelist.`, ephemeral: true });
      }
      return;
    }

    if (sub === 'status') {
      const wl = cfg.whitelist.length > 0 ? cfg.whitelist.map((id) => `<@${id}>`).join(', ') : 'None';
      const embed = new EmbedBuilder()
        .setColor(cfg.enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Anti-nuke — ${cfg.enabled ? 'Enabled' : 'Disabled'}`)
        .addFields(
          { name: 'Ban threshold',     value: `${cfg.ban_threshold}`,     inline: true },
          { name: 'Kick threshold',    value: `${cfg.kick_threshold}`,    inline: true },
          { name: 'Channel threshold', value: `${cfg.channel_threshold}`, inline: true },
          { name: 'Role threshold',    value: `${cfg.role_threshold}`,    inline: true },
          { name: 'Window',            value: `${cfg.window_seconds}s`,   inline: true },
          { name: 'Action',            value: cfg.action,                 inline: true },
          { name: 'Whitelist',         value: wl },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'logs') {
      const logs = getLogs(guildId);
      if (logs.length === 0) {
        await interaction.reply({ content: 'No anti-nuke triggers recorded.', ephemeral: true });
        return;
      }
      const lines = logs.map((l) =>
        `**${l.trigger_type}** — <@${l.actor_id}> — \`${l.action_taken}\` — <t:${Math.floor(l.timestamp / 1000)}:R>`
      );
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('Anti-nuke logs')
        .setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default antinuke;
