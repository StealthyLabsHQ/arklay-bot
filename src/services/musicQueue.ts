// Shared music queue map - accessible from any module via services
import type { GuildQueue } from '../modules/music/structures/GuildQueue';

const queues = new Map<string, GuildQueue>();

export function getQueues(): Map<string, GuildQueue> {
  return queues;
}
