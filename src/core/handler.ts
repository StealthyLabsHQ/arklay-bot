import type { Client, MessageContextMenuCommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { Events, ActivityType, OAuth2Scopes, PermissionFlagsBits } from 'discord.js';
import type { BotModule } from '../types';
import { logger } from '../services/logger';
import { config } from '../services/config';
import { TextInteractionAdapter, MissingArgError } from './textAdapter';

export function registerHandler(client: Client, modules: Map<string, BotModule>): void {
  // Build a flat command lookup: commandName → execute fn
  const commandMap = new Map<string, BotModule['commands'][number]['execute']>();
  const contextMenuMap = new Map<string, (interaction: MessageContextMenuCommandInteraction) => Promise<void>>();

  for (const mod of modules.values()) {
    for (const cmd of mod.commands) {
      commandMap.set(cmd.data.name, cmd.execute);
    }
    for (const ctx of mod.contextMenus ?? []) {
      contextMenuMap.set(ctx.data.name, ctx.execute);
    }
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    // Handle context menu commands
    if (interaction.isMessageContextMenuCommand()) {
      const execute = contextMenuMap.get(interaction.commandName);
      if (!execute) {
        logger.warn('Unknown context menu: %s', interaction.commandName);
        return;
      }
      logger.info(
        { guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName },
        'ctx-menu'
      );
      try {
        await execute(interaction);
      } catch (err) {
        logger.error({ err }, 'Error executing context menu %s', interaction.commandName);
        const msg = { content: 'An error occurred.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => undefined);
        } else {
          await interaction.reply(msg).catch(() => undefined);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const execute = commandMap.get(interaction.commandName);
    if (!execute) {
      logger.warn('Unknown command: %s', interaction.commandName);
      return;
    }

    logger.info(
      { guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName },
      'cmd'
    );

    try {
      await execute(interaction);
    } catch (err) {
      logger.error({ err }, 'Error executing command %s', interaction.commandName);
      const msg = { content: 'An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => undefined);
      } else {
        await interaction.reply(msg).catch(() => undefined);
      }
    }
  });

  // ── Text prefix commands (.play, arklay ask, etc.) ───────────────────────
  const prefix = config.BOT_PREFIX.toLowerCase();
  const botName = config.BOT_NAME.toLowerCase();

  // Commands that should NOT be handled via text prefix (subcommands, complex options)
  const TEXT_BLACKLIST = new Set(['config', 'warn', 'botrole', 'nanobanana']);

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild || !message.content) return;

    const content = message.content.trim();
    const lower = content.toLowerCase();

    let cmdName: string | undefined;
    let rawArgs = '';

    // Match: .command [args]
    if (lower.startsWith(prefix)) {
      const rest = content.slice(prefix.length);
      const spaceIdx = rest.indexOf(' ');
      cmdName = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
      rawArgs = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1);
    }
    // Match: botname command [args]  (e.g. "arklay ask hello")
    else if (lower.startsWith(botName + ' ')) {
      const rest = content.slice(botName.length + 1).trim();
      const spaceIdx = rest.indexOf(' ');
      cmdName = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
      rawArgs = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1);
    }

    if (!cmdName) return;

    const execute = commandMap.get(cmdName);
    if (!execute || TEXT_BLACKLIST.has(cmdName)) return;

    logger.info(
      { guildId: message.guildId, userId: message.author.id, command: cmdName },
      'text-cmd'
    );

    const adapter = new TextInteractionAdapter(message, cmdName, rawArgs);

    try {
      await execute(adapter as unknown as ChatInputCommandInteraction);
    } catch (err) {
      if (err instanceof MissingArgError) {
        await message.channel.send(`Usage: \`${prefix}${cmdName} <${err.argName}>\``).catch(() => undefined);
      } else {
        logger.error({ err }, 'Error executing text command %s', cmdName);
        await message.channel.send(`Usage: \`${prefix}${cmdName} <args>\` — Use \`/help ${cmdName}\` for details.`).catch(() => undefined);
      }
    }
  });

  logger.info('handler: text prefixes registered — "%s" and "%s <cmd>"', prefix, botName);

  client.once(Events.ClientReady, (c) => {
    logger.info('Bot connected: %s', c.user.tag);
    c.user.setActivity('/help', { type: ActivityType.Playing });

    const inviteUrl = c.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageGuildExpressions,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.MoveMembers,
      ],
    });
    logger.info('Invite URL: %s', inviteUrl);
  });
}
