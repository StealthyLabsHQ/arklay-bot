import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import type { TextChannel, VoiceBasedChannel } from 'discord.js';
import type { BotModule } from '../../types';
import { logger } from '../../services/logger';
import { getQueues } from '../../services/musicQueue';
import { loadAllQueueStates, deleteQueueState } from '../../services/musicResume';
import { waitForLavalink } from '../../services/lavalink';
import { GuildQueue } from './structures/GuildQueue';
import musicCmd from './commands/music_cmd';
import queueCmd from './commands/queue_cmd';

const musicModule: BotModule = {
  name: 'music',
  enabled: true,
  guildOnly: true,
  commands: [musicCmd, queueCmd],

  async onLoad(client: Client): Promise<void> {
    logger.info('music: module loaded (yt-dlp backend)');

    // Auto-resume: restore queues after bot restart
    client.once(Events.ClientReady, async () => {
      const states = loadAllQueueStates();
      if (states.length === 0) return;

      try {
        await waitForLavalink();
      } catch {
        logger.warn('music: Lavalink not ready, skipping queue restore');
        return;
      }

      logger.info('music: restoring %d queue(s) from previous session', states.length);

      for (const state of states) {
        try {
          const guild = client.guilds.cache.get(state.guildId);
          if (!guild) { deleteQueueState(state.guildId); continue; }

          const voiceChannel = guild.channels.cache.get(state.voiceChannelId) as VoiceBasedChannel | undefined;
          const textChannel  = guild.channels.cache.get(state.textChannelId) as TextChannel | undefined;
          if (!voiceChannel || !textChannel) { deleteQueueState(state.guildId); continue; }

          const q = new GuildQueue(state.guildId, textChannel);
          q.volume   = state.volume;
          q.loopMode = state.loopMode;
          q.tracks.push(...state.tracks);

          getQueues().set(state.guildId, q);

          const me = guild.members.me;
          if (me) await q.connect(voiceChannel, me);

          if (state.filter && state.filter !== 'none') {
            await q.setFilter(state.filter).catch(() => undefined);
          }

          if (q.tracks.length > 0) {
            q.playNext().catch((err) => logger.error({ err }, 'music: auto-resume playNext failed for %s', state.guildId));
          }

          logger.info('music: restored queue for guild %s (%d tracks)', state.guildId, state.tracks.length);
        } catch (err) {
          logger.error({ err }, 'music: failed to restore queue for guild %s', state.guildId);
          deleteQueueState(state.guildId);
        }
      }
    });
  },
};

export default musicModule;
