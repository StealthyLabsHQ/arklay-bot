import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import { REST, Routes } from 'discord.js';
import { config } from '../services/config';
import { loadModules } from './loader';
import { client } from './client';
import { logger } from '../services/logger';

async function deploy(): Promise<void> {
  const modules = await loadModules(client);

  const commands = [];
  for (const mod of modules.values()) {
    for (const cmd of mod.commands) {
      commands.push(cmd.data.toJSON());
    }
    for (const ctx of mod.contextMenus ?? []) {
      commands.push(ctx.data.toJSON());
    }
  }

  const rest = new REST().setToken(config.DISCORD_TOKEN);

  // Support multiple guild IDs separated by commas, or empty/absent for global
  const guildIds = config.GUILD_ID
    ? config.GUILD_ID.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  if (guildIds.length > 0) {
    for (const guildId of guildIds) {
      const route = Routes.applicationGuildCommands(config.CLIENT_ID, guildId);
      logger.info('Deploying %d command(s) to guild %s...', commands.length, guildId);
      await rest.put(route, { body: commands });
    }
    logger.info('Commands deployed to %d guild(s)', guildIds.length);
  } else {
    const route = Routes.applicationCommands(config.CLIENT_ID);
    logger.info('Deploying %d command(s) globally...', commands.length);
    await rest.put(route, { body: commands });
    logger.info('Commands deployed globally');
  }

  process.exit(0);
}

deploy().catch((err) => {
  logger.error({ err }, 'Deploy failed');
  process.exit(1);
});
