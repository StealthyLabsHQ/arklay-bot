import { Shoukaku, Connectors } from 'shoukaku';
import type { Client } from 'discord.js';
import { config } from './config';
import { logger } from './logger';

let shoukaku: Shoukaku | null = null;
let lavalinkAvailable = false;

export function initLavalink(client: Client): Shoukaku {
  const nodes = [{
    name: 'main',
    url: config.LAVALINK_HOST,
    auth: config.LAVALINK_PASSWORD,
  }];

  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    reconnectTries: 3,
    reconnectInterval: 5000,
  });

  shoukaku.on('ready', (name) => {
    lavalinkAvailable = true;
    logger.info('lavalink: node %s connected — music is operational', name);
  });
  shoukaku.on('error', (name, err) => {
    const errStr = err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
    const isRefused = errStr.includes('ECONNREFUSED') || (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ECONNREFUSED');
    if (isRefused) {
      lavalinkAvailable = false;
      logger.warn('lavalink: node %s unreachable — music commands will be disabled. Start Lavalink and restart the bot.', name);
    } else {
      logger.error({ err }, 'lavalink: node %s error', name);
    }
  });
  shoukaku.on('close', (name, code, reason) => {
    lavalinkAvailable = false;
    logger.warn('lavalink: node %s closed [%d] %s — music disabled until reconnection', name, code, reason);
  });
  shoukaku.on('disconnect', (name, count) => {
    lavalinkAvailable = false;
    logger.warn('lavalink: node %s disconnected, %d players affected', name, count);
  });

  return shoukaku;
}

/** Returns true if at least one Lavalink node is connected. */
export function isLavalinkReady(): boolean {
  return lavalinkAvailable;
}

export function getShoukaku(): Shoukaku {
  if (!shoukaku) throw new Error('Lavalink not initialized');
  return shoukaku;
}

/** Resolves when at least one Lavalink node is connected (or rejects after timeout). */
export function waitForLavalink(timeoutMs = 15_000): Promise<void> {
  if (!shoukaku) return Promise.reject(new Error('Lavalink not initialized'));
  if (shoukaku.nodes.size > 0) {
    const node = [...shoukaku.nodes.values()][0];
    if (node?.state === 1 /* State.CONNECTED */) return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('Lavalink connection timeout')); }, timeoutMs);
    shoukaku!.once('ready', () => { clearTimeout(timer); resolve(); });
  });
}
