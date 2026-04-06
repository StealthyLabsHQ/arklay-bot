import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first'); // Node 24 defaults to IPv6-first - breaks UDP voice on Windows

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ override: true });
import './services/db'; // Initialize SQLite before anything else
import { config } from './services/config';
import { client } from './core/client';
import { loadModules } from './core/loader';
import { registerHandler } from './core/handler';
import { logger } from './services/logger';
import { initLavalink } from './services/lavalink';

// Prevent unhandled rejections from crashing the bot
process.on('unhandledRejection', (err) => {
  // Suppress Discord "Unknown interaction" (expired interactions) — normal when users click old buttons
  const code = (err as Record<string, unknown>)?.['code'];
  if (code === 10062 || code === 'InteractionAlreadyReplied') return;
  logger.error({ err }, 'Unhandled rejection (bot will continue)');
});

(async () => {
  initLavalink(client);
  const modules = await loadModules(client);
  registerHandler(client, modules);
  await client.login(config.DISCORD_TOKEN);
  logger.debug('Login initiated');
})().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
