import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ override: true });
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

  const route = config.GUILD_ID
    ? Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)
    : Routes.applicationCommands(config.CLIENT_ID);

  const scope = config.GUILD_ID ? `guild ${config.GUILD_ID}` : 'global';

  logger.info('Deploying %d command(s) [%s]...', commands.length, scope);
  await rest.put(route, { body: commands });
  logger.info('Commands deployed successfully');

  process.exit(0);
}

deploy().catch((err) => {
  logger.error({ err }, 'Deploy failed');
  process.exit(1);
});
