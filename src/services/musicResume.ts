// Music auto-resume - save/restore queue state across restarts
import db from './db';
import type { Track, LoopMode } from '../modules/music/structures/GuildQueue';

export interface QueueState {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  tracks: Track[];
  volume: number;
  loopMode: LoopMode;
  filter: string;
}

const stmtSave = db.prepare(`
  INSERT INTO music_resume (guild_id, voice_channel_id, text_channel_id, tracks_json, volume, loop_mode, filter)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    voice_channel_id = excluded.voice_channel_id,
    text_channel_id = excluded.text_channel_id,
    tracks_json = excluded.tracks_json,
    volume = excluded.volume,
    loop_mode = excluded.loop_mode,
    filter = excluded.filter
`);

const stmtLoad = db.prepare('SELECT * FROM music_resume');
const stmtDelete = db.prepare('DELETE FROM music_resume WHERE guild_id = ?');
const stmtDeleteAll = db.prepare('DELETE FROM music_resume');

export function saveQueueState(state: QueueState): void {
  stmtSave.run(
    state.guildId,
    state.voiceChannelId,
    state.textChannelId,
    JSON.stringify(state.tracks),
    state.volume,
    state.loopMode,
    state.filter,
  );
}

export function loadAllQueueStates(): QueueState[] {
  const rows = stmtLoad.all() as Array<{
    guild_id: string;
    voice_channel_id: string;
    text_channel_id: string;
    tracks_json: string;
    volume: number;
    loop_mode: LoopMode;
    filter: string;
  }>;
  return rows.map((r) => ({
    guildId: r.guild_id,
    voiceChannelId: r.voice_channel_id,
    textChannelId: r.text_channel_id,
    tracks: JSON.parse(r.tracks_json) as Track[],
    volume: r.volume,
    loopMode: r.loop_mode,
    filter: r.filter,
  }));
}

export function deleteQueueState(guildId: string): void {
  stmtDelete.run(guildId);
}

export function deleteAllQueueStates(): void {
  stmtDeleteAll.run();
}
