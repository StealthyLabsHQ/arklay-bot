import fs from 'fs';
import path from 'path';
import type { Client } from 'discord.js';
import type { BotModule } from '../types';
import { logger } from '../services/logger';

export async function loadModules(client: Client): Promise<Map<string, BotModule>> {
  const modules = new Map<string, BotModule>();
  const modulesDir = path.join(__dirname, '..', 'modules');

  if (!fs.existsSync(modulesDir)) {
    logger.warn('No modules directory found at %s', modulesDir);
    return modules;
  }

  const entries = fs.readdirSync(modulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(modulesDir, entry.name, 'index.js');
    // In dev (ts-node) the extension is .ts
    const indexPathTs = path.join(modulesDir, entry.name, 'index.ts');

    const resolvedPath = fs.existsSync(indexPath)
      ? indexPath
      : fs.existsSync(indexPathTs)
        ? indexPathTs
        : null;

    if (!resolvedPath) {
      logger.warn('Module %s has no index file, skipping', entry.name);
      continue;
    }

    try {
      const mod = (await import(resolvedPath)) as { default?: BotModule } | BotModule;
      const botModule: BotModule = 'default' in mod && mod.default ? mod.default : (mod as BotModule);

      if (!botModule.name || typeof botModule.enabled !== 'boolean') {
        logger.warn('Module %s exports invalid BotModule, skipping', entry.name);
        continue;
      }

      if (!botModule.enabled) {
        logger.info('Module %s is disabled, skipping', botModule.name);
        continue;
      }

      if (botModule.onLoad) {
        await botModule.onLoad(client);
      }

      modules.set(botModule.name, botModule);
      logger.info('Module loaded: %s (%d commands)', botModule.name, botModule.commands.length);
    } catch (err) {
      logger.error({ err }, 'Failed to load module %s', entry.name);
    }
  }

  logger.info('Loaded %d module(s)', modules.size);
  return modules;
}
