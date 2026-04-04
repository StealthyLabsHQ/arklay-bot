import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  StreamType,
} from '@discordjs/voice';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { GuildMember, Message, TextChannel, VoiceBasedChannel } from 'discord.js';
import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import ytDlp from 'yt-dlp-exec';
import ffmpegStatic from 'ffmpeg-static';
import { logger } from '../../../services/logger';
import { saveQueueState, deleteQueueState } from '../../../services/musicResume';

function resolveFfmpeg(): string {
  // 1. System ffmpeg in PATH
  const sys = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (sys.status === 0) {
    logger.info('music: using system ffmpeg');
    return 'ffmpeg';
  }
  // 2. ffmpeg-static
  const staticPath = ffmpegStatic as unknown as string;
  if (staticPath) {
    const check = spawnSync(staticPath, ['-version'], { encoding: 'utf8' });
    if (check.status === 0) {
      logger.info('music: using ffmpeg-static');
      return staticPath;
    }
  }
  // 3. Fallback - hope it's somewhere
  logger.warn('music: ffmpeg not found! Music playback will fail. Install ffmpeg or check ffmpeg-static.');
  return 'ffmpeg';
}

const ffmpegPath = resolveFfmpeg();
const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

export interface Track {
  title: string;
  url: string;
  playUrl: string;
  audioUrl?: string | null;  // direct audio URL (pre-resolved, skips 2nd yt-dlp call)
  duration: number | null;   // seconds
  durationStr: string;       // "m:ss"
  thumbnail: string | null;
  source: string;
  requestedBy: string;
}

export type LoopMode = 'off' | 'track' | 'queue';

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '??:??';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sourceColor(source: string): number {
  if (source === 'spotify')    return 0x1db954;
  if (source === 'soundcloud') return 0xff5500;
  return 0xff0000; // youtube / search
}

export class GuildQueue {
  readonly guildId: string;
  tracks: Track[] = [];
  currentTrack: Track | null = null;
  history: Track[] = [];
  player: AudioPlayer;
  connection: VoiceConnection | null = null;
  isPlaying = false;
  loopMode: LoopMode = 'off';
  volume = 50;
  autoplay = false;

  private _playStart: number | null = null;
  private _pauseStart: number | null = null;
  private _pausedTime = 0;

  private textChannel: TextChannel;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;
  private currentResource: AudioResource | null = null;
  private currentAudioUrl: string | null = null;
  private ffmpegProcess: ReturnType<typeof spawn> | null = null;
  private activeFilter: string = 'none';
  private _internalRestart = false;
  private nowPlayingMessage: Message | null = null;
  voiceChannelId: string | null = null;

  constructor(guildId: string, textChannel: TextChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Playing, () => {
      if (this._internalRestart) {
        this._internalRestart = false;
        return;
      }
      this._playStart = Date.now();
      this._pausedTime = 0;
      this._pauseStart = null;
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this._pauseStart = Date.now();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this._internalRestart) return;
      this._playStart = null;
      this.isPlaying = false;
      this.currentResource = null;

      const finished = this.currentTrack;
      this.currentTrack = null;

      if (finished) {
        // Save to history (max 50)
        this.history.unshift(finished);
        if (this.history.length > 50) this.history.length = 50;

        if (this.loopMode === 'track') {
          this.tracks.unshift(finished);
        } else if (this.loopMode === 'queue') {
          this.tracks.push(finished);
        }
      }

      if (this.tracks.length > 0) {
        this.playNext().catch((err) => logger.error({ err }, 'playNext error in Idle handler'));
      } else if (this.autoplay && finished) {
        this.resolveAutoplay(finished).catch((err) => logger.error({ err }, 'autoplay error'));
      } else {
        this.scheduleDestroy();
      }
    });

    this.player.on('error', (err) => {
      logger.error({ err }, 'AudioPlayer error in guild %s', this.guildId);
      this.isPlaying = false;
      this.currentResource = null;
      if (this.tracks.length > 0) {
        this.playNext().catch(() => undefined);
      }
    });
  }

  getPlaybackDuration(): number {
    if (!this._playStart) return 0;
    let paused = this._pausedTime;
    if (this._pauseStart) paused += Date.now() - this._pauseStart;
    return Math.floor((Date.now() - this._playStart - paused) / 1000);
  }

  connect(voiceChannel: VoiceBasedChannel, _member: GuildMember): void {
    // Don't reconnect if already active
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      return;
    }

    this.cancelDestroyTimer();
    this.voiceChannelId = voiceChannel.id;

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: this.guildId,
      selfDeaf: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
    });

    this.connection.subscribe(this.player);

    this.connection.on('stateChange', (oldState, newState) => {
      logger.debug('[Voice] %s → %s', oldState.status, newState.status);
    });

    this.connection.on('error', (err) => {
      logger.error({ err }, '[Voice] Connection error in guild %s', this.guildId);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      const conn = this.connection;
      if (!conn) return;
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  async playNext(): Promise<void> {
    if (this.isPlaying) return;

    const track = this.tracks.shift();
    if (!track) {
      this.scheduleDestroy();
      return;
    }

    this.currentTrack = track;
    this.isPlaying = true;
    this.cancelDestroyTimer();

    try {
      if (!track.playUrl && !track.audioUrl) throw new Error(`No playUrl for track: ${track.title}`);

      let audioUrl = track.audioUrl ?? null;

      // Skip yt-dlp if we already have a direct audio URL (pre-resolved or pre-fetched)
      if (!audioUrl) {
        logger.debug('[Player] Resolving audio URL: %s', track.title);
        const ytDlpOpts: Record<string, unknown> = {
          dumpSingleJson: true,
          format: 'bestaudio[abr>=192]/bestaudio[acodec=opus]/bestaudio/best',
          noCheckCertificates: true,
          noWarnings: true,
          quiet: true,
        };
        if (existsSync(COOKIES_FILE)) ytDlpOpts['cookies'] = COOKIES_FILE;

        const info = await (ytDlp as unknown as (url: string, opts: object) => Promise<{ url?: string }>)(
          track.playUrl, ytDlpOpts
        );
        audioUrl = info.url ?? null;
        if (!audioUrl) throw new Error('yt-dlp returned no audio URL');
      } else {
        logger.debug('[Player] Using pre-resolved audio URL: %s', track.title);
      }

      this.currentAudioUrl = audioUrl;

      // Stream via ffmpeg
      logger.info('[Player] Streaming: %s | URL length: %d', track.title, audioUrl.length);
      const ffmpeg = this.spawnFfmpeg(audioUrl, 0, this.activeFilter);

      ffmpeg.on('error', (err) => logger.error({ err }, '[ffmpeg] spawn error'));
      ffmpeg.stderr!.on('data', (data: Buffer) => logger.warn('[ffmpeg] %s', data.toString().trim()));

      const resource = createAudioResource(ffmpeg.stdout!, {
        inputType: StreamType.OggOpus,
      });
      this.currentResource = resource;
      this.player.play(resource);

      // Persistent Now Playing UI
      await this.updateNowPlaying();
      this.persistState();

      // Pre-fetch next track's audio URL while current is playing
      this.prefetchNext();

    } catch (err) {
      logger.error({ err }, '[Player] Failed to stream: %s', track.title);
      this.isPlaying = false;
      this.currentTrack = null;
      this.currentResource = null;
      this.textChannel.send(`Could not play **${track.title}**, skipping.`).catch(() => undefined);
      await this.playNext();
    }
  }

  pause(): boolean {
    if (this._pauseStart) return false; // already paused
    const ok = this.player.pause();
    if (ok) this._pauseStart = Date.now();
    return ok;
  }

  resume(): boolean {
    if (this._pauseStart) {
      this._pausedTime += Date.now() - this._pauseStart;
      this._pauseStart = null;
    }
    return this.player.unpause();
  }

  skip(): void {
    this.player.stop(true);
  }

  async setVolume(level: number): Promise<boolean> {
    this.volume = level;
    // Volume is baked into ffmpeg filter - restart stream at current position
    if (!this.currentAudioUrl) return false;
    const elapsed = this.getPlaybackDuration();
    this.killFfmpeg();
    const ffmpeg = this.spawnFfmpeg(this.currentAudioUrl, elapsed, this.activeFilter);
    ffmpeg.on('error', (err) => logger.error({ err }, '[ffmpeg] volume error'));
    ffmpeg.stderr!.on('data', (data: Buffer) => logger.warn('[ffmpeg] %s', data.toString().trim()));
    const resource = createAudioResource(ffmpeg.stdout!, { inputType: StreamType.OggOpus });
    this.currentResource = resource;
    this._internalRestart = true;
    this.player.play(resource);
    this._playStart = Date.now() - elapsed * 1000;
    this._pausedTime = 0;
    this._pauseStart = null;
    return true;
  }

  removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.tracks.length) return null;
    return this.tracks.splice(index, 1)[0] ?? null;
  }

  moveTrack(from: number, to: number): boolean {
    if (from < 0 || from >= this.tracks.length || to < 0 || to >= this.tracks.length) return false;
    const [track] = this.tracks.splice(from, 1);
    this.tracks.splice(to, 0, track!);
    return true;
  }

  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j]!, this.tracks[i]!];
    }
  }

  async seekTo(seconds: number): Promise<void> {
    if (!this.currentAudioUrl) throw new Error('No audio URL to seek');
    this.killFfmpeg();
    const ffmpeg = this.spawnFfmpeg(this.currentAudioUrl, seconds, this.activeFilter);
    ffmpeg.on('error', (err) => logger.error({ err }, '[ffmpeg] seek error'));
    ffmpeg.stderr!.on('data', (data: Buffer) => logger.warn('[ffmpeg] %s', data.toString().trim()));

    const resource = createAudioResource(ffmpeg.stdout!, { inputType: StreamType.OggOpus });
    this.currentResource = resource;
    this._internalRestart = true;
    this.player.play(resource);
    this._playStart = Date.now() - seconds * 1000;
    this._pausedTime = 0;
    this._pauseStart = null;
  }

  async setFilter(type: string): Promise<void> {
    this.activeFilter = type;
    if (!this.currentAudioUrl) throw new Error('No audio URL');
    const elapsed = this.getPlaybackDuration();
    this.killFfmpeg();

    const ffmpeg = this.spawnFfmpeg(this.currentAudioUrl, elapsed, type);
    ffmpeg.on('error', (err) => logger.error({ err }, '[ffmpeg] filter error'));
    ffmpeg.stderr!.on('data', (data: Buffer) => logger.warn('[ffmpeg] %s', data.toString().trim()));

    const resource = createAudioResource(ffmpeg.stdout!, { inputType: StreamType.OggOpus });
    this.currentResource = resource;
    this._internalRestart = true;
    this.player.play(resource);
    this._playStart = Date.now() - elapsed * 1000;
    this._pausedTime = 0;
    this._pauseStart = null;
  }

  getTextChannel(): TextChannel { return this.textChannel; }
  getActiveFilter(): string { return this.activeFilter; }

  private async resolveAutoplay(lastTrack: Track): Promise<void> {
    try {
      const query = `${lastTrack.title} similar music`;
      logger.debug('[Autoplay] Searching: %s', query);
      const ytDlpOpts: Record<string, unknown> = {
        dumpSingleJson: true,
        format: 'bestaudio[abr>=192]/bestaudio[acodec=opus]/bestaudio/best',
        noCheckCertificates: true,
        noWarnings: true,
        quiet: true,
      };
      if (existsSync(COOKIES_FILE)) ytDlpOpts['cookies'] = COOKIES_FILE;

      const info = await (ytDlp as unknown as (url: string, opts: object) => Promise<{ entries?: Array<{ id?: string; title?: string; url?: string; webpage_url?: string; duration?: number; thumbnail?: string; thumbnails?: Array<{ url: string }> }> }>)(
        `ytsearch3:${query}`, ytDlpOpts
      );

      const entries = info.entries ?? [];
      // Pick a random result that isn't the same as the last track
      const filtered = entries.filter((e) => e.webpage_url !== lastTrack.url && e.title !== lastTrack.title);
      const pick = filtered[Math.floor(Math.random() * filtered.length)] ?? entries[0];
      if (!pick) { this.scheduleDestroy(); return; }

      const track: Track = {
        title:       pick.title ?? 'Unknown',
        url:         pick.webpage_url ?? pick.url ?? '',
        playUrl:     pick.webpage_url ?? pick.url ?? '',
        audioUrl:    pick.url && pick.url !== pick.webpage_url ? pick.url : null,
        duration:    pick.duration ?? null,
        durationStr: formatDuration(pick.duration ?? null),
        thumbnail:   pick.thumbnails?.[0]?.url ?? null,
        source:      'autoplay',
        requestedBy: 'Autoplay',
      };

      this.tracks.push(track);
      this.textChannel.send(`Autoplay: added **${track.title}**`).catch(() => undefined);
      this.playNext().catch((err) => logger.error({ err }, 'autoplay playNext error'));
    } catch {
      this.scheduleDestroy();
    }
  }

  private prefetchNext(): void {
    const next = this.tracks[0];
    if (!next || next.audioUrl) return; // already resolved or no next track

    const ytDlpOpts: Record<string, unknown> = {
      dumpSingleJson: true,
      format: 'bestaudio[abr>=192]/bestaudio[acodec=opus]/bestaudio/best',
      noCheckCertificates: true,
      noWarnings: true,
      quiet: true,
    };
    if (existsSync(COOKIES_FILE)) ytDlpOpts['cookies'] = COOKIES_FILE;

    (ytDlp as unknown as (url: string, opts: object) => Promise<{ url?: string }>)(
      next.playUrl, ytDlpOpts
    ).then((info) => {
      // Only set if track is still in queue (not skipped/removed)
      if (this.tracks[0] === next && info.url) {
        next.audioUrl = info.url;
        logger.debug('[Player] Pre-fetched audio URL for: %s', next.title);
      }
    }).catch(() => {
      // Ignore pre-fetch failures - will retry in playNext()
    });
  }

  destroy(): void {
    this.cancelDestroyTimer();
    this.killFfmpeg();
    this.disableNowPlaying();
    this.tracks = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.currentResource = null;
    this.currentAudioUrl = null;
    this.activeFilter = 'none';
    this.player.stop(true);
    deleteQueueState(this.guildId);
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  // ── Persistent Now Playing UI ──────────────────────────────────────────────

  private buildNowPlayingEmbed(): EmbedBuilder {
    const track = this.currentTrack;
    if (!track) return new EmbedBuilder().setColor(0x5865f2).setDescription('No track playing.');

    const loopTag = this.loopMode !== 'off' ? ` | Loop: ${this.loopMode}` : '';
    const filterTag = this.activeFilter !== 'none' ? ` | Filter: ${this.activeFilter}` : '';
    const isPaused = !!this._pauseStart;

    const embed = new EmbedBuilder()
      .setColor(sourceColor(track.source))
      .setAuthor({ name: isPaused ? 'Paused' : 'Now Playing' })
      .setTitle(track.title)
      .setURL(track.url)
      .addFields(
        { name: 'Duration',     value: track.durationStr,     inline: true },
        { name: 'Requested by', value: track.requestedBy,     inline: true },
        { name: 'Queue',        value: `${this.tracks.length} track${this.tracks.length !== 1 ? 's' : ''} remaining`, inline: true },
      )
      .setFooter({ text: `Volume: ${this.volume}%${loopTag}${filterTag}` });
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    return embed;
  }

  private buildPlayerButtons(): ActionRowBuilder<ButtonBuilder> {
    const isPaused = !!this._pauseStart;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_pauseresume')
        .setEmoji(isPaused ? '\u25B6' : '\u23F8')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('player_skip')
        .setEmoji('\u23ED')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('player_stop')
        .setEmoji('\u23F9')
        .setStyle(ButtonStyle.Danger),
      (() => {
        const btn = new ButtonBuilder()
          .setCustomId('player_loop')
          .setEmoji('\uD83D\uDD01')
          .setStyle(this.loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary);
        if (this.loopMode !== 'off') btn.setLabel(this.loopMode);
        return btn;
      })(),
      new ButtonBuilder()
        .setCustomId('player_shuffle')
        .setEmoji('\uD83D\uDD00')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  async updateNowPlaying(): Promise<void> {
    const embed = this.buildNowPlayingEmbed();
    const components = [this.buildPlayerButtons()];

    try {
      if (this.nowPlayingMessage) {
        await this.nowPlayingMessage.edit({ embeds: [embed], components }).catch(() => {
          this.nowPlayingMessage = null;
        });
      }
      if (!this.nowPlayingMessage) {
        this.nowPlayingMessage = await this.textChannel.send({ embeds: [embed], components });
        this.setupButtonCollector();
      }
    } catch {
      // Channel may be deleted
    }
  }

  private disableNowPlaying(): void {
    if (this.nowPlayingMessage) {
      this.nowPlayingMessage.edit({ components: [] }).catch(() => undefined);
      this.nowPlayingMessage = null;
    }
  }

  private setupButtonCollector(): void {
    if (!this.nowPlayingMessage) return;

    const collector = this.nowPlayingMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 86_400_000, // 24h
    });

    collector.on('collect', async (btn) => {
      try {
        switch (btn.customId) {
          case 'player_pauseresume':
            if (this._pauseStart) this.resume(); else this.pause();
            await this.updateNowPlaying();
            await btn.deferUpdate();
            break;
          case 'player_skip':
            this.skip();
            await btn.deferUpdate();
            break;
          case 'player_stop':
            this.destroy();
            await btn.deferUpdate();
            break;
          case 'player_loop': {
            const modes: LoopMode[] = ['off', 'track', 'queue'];
            const idx = modes.indexOf(this.loopMode);
            this.loopMode = modes[(idx + 1) % modes.length]!;
            await this.updateNowPlaying();
            await btn.deferUpdate();
            break;
          }
          case 'player_shuffle':
            this.shuffle();
            await this.updateNowPlaying();
            await btn.deferUpdate();
            break;
          default:
            await btn.deferUpdate();
        }
      } catch {
        await btn.deferUpdate().catch(() => undefined);
      }
    });

    collector.on('end', () => {
      this.disableNowPlaying();
    });
  }

  // ── State persistence for auto-resume ──────────────────────────────────────

  persistState(): void {
    if (!this.voiceChannelId) return;
    const allTracks = this.currentTrack ? [this.currentTrack, ...this.tracks] : [...this.tracks];
    saveQueueState({
      guildId: this.guildId,
      voiceChannelId: this.voiceChannelId,
      textChannelId: this.textChannel.id,
      tracks: allTracks,
      volume: this.volume,
      loopMode: this.loopMode,
      filter: this.activeFilter,
    });
  }

  private spawnFfmpeg(audioUrl: string, seekSec: number, filterType: string): ReturnType<typeof spawn> {
    const FILTER_MAP: Record<string, string> = {
      bassboost:      'bass=g=6,alimiter=limit=0.95',
      nightcore:      'asetrate=48000*1.25,aresample=48000,atempo=1.06',
      vaporwave:      'asetrate=48000*0.8,aresample=48000,atempo=0.94',
      '8d':           'apulsator=hz=0.08',
      slowed_reverb:  'asetrate=48000*0.85,aresample=48000,atempo=0.94,aecho=0.8:0.88:40|50:0.25|0.2,alimiter=limit=0.95',
      speed_reverb:   'asetrate=48000*1.2,aresample=48000,atempo=1.06,aecho=0.8:0.85:35|45:0.2|0.15,alimiter=limit=0.95',
      treble:         'treble=g=5,alimiter=limit=0.95',
      karaoke:        'stereotools=mlev=0.015625',
      deepbass:       'bass=g=8,equalizer=f=50:width_type=h:width=80:g=6,alimiter=limit=0.95',
      chipmunk:       'asetrate=48000*1.5,aresample=48000,atempo=0.75',
    };

    const args: string[] = [
      '-reconnect',          '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max','5',
    ];
    if (seekSec > 0) args.push('-ss', String(seekSec));
    args.push(
      '-i',                audioUrl,
      '-analyzeduration',  '0',
      '-loglevel',         'warning',
    );

    // Build audio filter chain
    const userFilter = FILTER_MAP[filterType];
    // Volume filter for Ogg/Opus mode (no inlineVolume)
    const volFilter = `volume=${this.volume / 100}`;
    const filters = [volFilter, userFilter].filter(Boolean).join(',');
    args.push('-af', filters);

    // Output: Opus in OGG container at 192kbps - discord.js passes through without re-encoding
    args.push(
      '-c:a',              'libopus',
      '-b:a',              '192k',
      '-vbr',              'on',
      '-compression_level','10',
      '-application',      'audio',
      '-ar',               '48000',
      '-ac',               '2',
      '-f',                'ogg',
      'pipe:1',
    );

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.ffmpegProcess = proc;
    return proc;
  }

  private killFfmpeg(): void {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGKILL');
      this.ffmpegProcess = null;
    }
  }

  private scheduleDestroy(): void {
    this.cancelDestroyTimer();
    const IDLE_TIMEOUT = 5 * 60_000; // 5 minutes
    this.destroyTimer = setTimeout(() => {
      this.destroy();
      this.textChannel.send('No music for 5 minutes — disconnected.').catch(() => undefined);
    }, IDLE_TIMEOUT);
  }

  private cancelDestroyTimer(): void {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }
  }
}
