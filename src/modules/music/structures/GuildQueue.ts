import type { Player, Track as LavalinkTrack } from 'shoukaku';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import type { GuildMember, Message, TextChannel, VoiceBasedChannel } from 'discord.js';
import { getShoukaku } from '../../../services/lavalink';
import { logger } from '../../../services/logger';
import { saveQueueState, deleteQueueState } from '../../../services/musicResume';
import { recordPlay } from '../commands/stats';

export interface Track {
  title: string;
  artist?: string | null;
  album?: string | null;
  uploadDate?: string | null;
  url: string;
  playUrl: string;
  encoded?: string | null;   // Lavalink encoded track (for direct play)
  audioUrl?: string | null;  // kept for compatibility
  duration: number | null;   // seconds
  durationStr: string;
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
  if (source === 'youtube')    return 0xff0000;
  return 0x5865f2; // Discord blurple for unknown/autoplay/other
}

// ── Lavalink filter presets ──────────────────────────────────────────────────

interface LavalinkFilters {
  volume?: number;
  equalizer?: Array<{ band: number; gain: number }>;
  timescale?: { speed?: number; pitch?: number; rate?: number };
  rotation?: { rotationHz?: number };
  karaoke?: { level?: number; monoLevel?: number; filterBand?: number; filterWidth?: number };
  tremolo?: { frequency?: number; depth?: number };
  vibrato?: { frequency?: number; depth?: number };
  distortion?: Record<string, number>;
  channelMix?: { leftToLeft?: number; leftToRight?: number; rightToLeft?: number; rightToRight?: number };
  lowPass?: { smoothing?: number };
}

const FILTER_PRESETS: Record<string, LavalinkFilters> = {
  none: {},
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.3 }, { band: 1, gain: 0.25 },
      { band: 2, gain: 0.2 }, { band: 3, gain: 0.15 },
      { band: 4, gain: 0.05 },
    ],
  },
  nightcore: {
    timescale: { speed: 1.25, pitch: 1.25, rate: 1.0 },
  },
  vaporwave: {
    timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 },
  },
  '8d': {
    rotation: { rotationHz: 0.08 },
  },
  slowed_reverb: {
    timescale: { speed: 0.85, pitch: 0.85, rate: 1.0 },
  },
  speed_reverb: {
    timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 },
  },
  treble: {
    equalizer: [
      { band: 10, gain: 0.25 }, { band: 11, gain: 0.3 },
      { band: 12, gain: 0.3 }, { band: 13, gain: 0.25 },
      { band: 14, gain: 0.2 },
    ],
  },
  karaoke: {
    karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 },
  },
  deepbass: {
    equalizer: [
      { band: 0, gain: 0.45 }, { band: 1, gain: 0.4 },
      { band: 2, gain: 0.3 }, { band: 3, gain: 0.2 },
    ],
  },
  chipmunk: {
    timescale: { speed: 1.0, pitch: 1.5, rate: 1.0 },
  },
};

// ── GuildQueue ───────────────────────────────────────────────────────────────

export class GuildQueue {
  readonly guildId: string;
  tracks: Track[] = [];
  currentTrack: Track | null = null;
  history: Track[] = [];
  isPlaying = false;
  loopMode: LoopMode = 'off';
  volume = 50;
  autoplay = false;
  shuffled = false;
  stayConnected = false;
  voiceChannelId: string | null = null;

  private lavalinkPlayer: Player | null = null;
  private textChannel: TextChannel;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;
  private activeFilter: string = 'none';
  private nowPlayingMessage: Message | null = null;
  private _pauseStart: number | null = null;

  constructor(guildId: string, textChannel: TextChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async connect(voiceChannel: VoiceBasedChannel, _member: GuildMember): Promise<void> {
    if (this.lavalinkPlayer) return;

    this.cancelDestroyTimer();
    this.voiceChannelId = voiceChannel.id;

    const shoukaku = getShoukaku();

    // Reuse existing connection if available
    const existing = shoukaku.players.get(this.guildId);
    if (existing) {
      this.lavalinkPlayer = existing;
      await this.lavalinkPlayer.setGlobalVolume(this.volume);
      return;
    }

    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (!node) throw new Error('No Lavalink node available');

    this.lavalinkPlayer = await shoukaku.joinVoiceChannel({
      guildId: this.guildId,
      channelId: voiceChannel.id,
      shardId: 0,
      deaf: true,
    });

    // Set initial volume (Lavalink uses 0-1000, 100 = 100%)
    await this.lavalinkPlayer.setGlobalVolume(this.volume);

    this.lavalinkPlayer.on('start', () => {
      logger.debug('[Lavalink] Track started in guild %s', this.guildId);
    });

    this.lavalinkPlayer.on('end', (data) => {
      // Don't process if replaced (seek/filter change)
      if (data.reason === 'replaced') return;

      this.isPlaying = false;
      this._pauseStart = null;

      const finished = this.currentTrack;
      this.currentTrack = null;

      if (finished) {
        this.history.unshift(finished);
        if (this.history.length > 50) this.history.length = 50;

        if (this.loopMode === 'track') {
          this.tracks.unshift(finished);
        } else if (this.loopMode === 'queue') {
          this.tracks.push(finished);
        }
      }

      if (this.tracks.length > 0) {
        this.playNext().catch((err) => logger.error({ err }, 'playNext error in end handler'));
      } else if (this.autoplay && finished) {
        this.resolveAutoplay(finished).catch((err) => logger.error({ err }, 'autoplay error'));
      } else {
        this.scheduleDestroy();
      }
    });

    this.lavalinkPlayer.on('closed', () => {
      logger.warn('[Lavalink] Connection closed for guild %s', this.guildId);
      this.destroy();
    });

    this.lavalinkPlayer.on('exception', (err) => {
      logger.error({ err }, '[Lavalink] Track exception in guild %s', this.guildId);
      this.isPlaying = false;
      // Clear encoded data on remaining tracks to force re-resolution via SoundCloud
      for (const t of this.tracks) {
        if (t.encoded) t.encoded = null;
      }
      if (this.tracks.length > 0) {
        this.playNext().catch((e) => logger.warn({ err: e }, 'playNext failed in exception handler'));
      }
    });
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  async playNext(): Promise<void> {
    if (this.isPlaying) return;
    if (!this.lavalinkPlayer) return;

    const track = this.tracks.shift();
    if (!track) {
      this.scheduleDestroy();
      return;
    }

    this.currentTrack = track;
    this.isPlaying = true;
    this._pauseStart = null;
    this.cancelDestroyTimer();

    // Record play for /stats
    const requester = track.requestedBy.replace(/[<@!>]/g, '');
    if (requester) recordPlay(this.guildId, requester, track.title, track.artist);

    try {
      let encoded = track.encoded;

      // If no encoded track, search via Lavalink
      if (!encoded) {
        const node = this.lavalinkPlayer.node;
        // SoundCloud first (YouTube is currently broken), then YouTube as fallback
        const isUrl = track.url.startsWith('http');
        const searchQueries = isUrl
          ? [track.url]
          : [`scsearch:${track.playUrl}`, `ytsearch:${track.playUrl}`];
        let result: Awaited<ReturnType<typeof node.rest.resolve>> | null = null;
        for (const q of searchQueries) {
          result = await node.rest.resolve(q);
          if (result && result.loadType !== 'empty' && result.loadType !== 'error') break;
          result = null;
        }

        if (!result) {
          throw new Error(`No results for: ${track.title}`);
        }

        const lavalinkTrack = result.loadType === 'track' ? result.data
          : result.loadType === 'search' ? (result.data as LavalinkTrack[])[0]
          : result.loadType === 'playlist' ? (result.data as { tracks: LavalinkTrack[] }).tracks[0]
          : null;

        if (!lavalinkTrack) throw new Error(`Could not resolve: ${track.title}`);

        encoded = lavalinkTrack.encoded;
        // Enrich track data from Lavalink
        if (!track.artist && lavalinkTrack.info.author) track.artist = lavalinkTrack.info.author;
        if (!track.thumbnail && lavalinkTrack.info.artworkUrl) track.thumbnail = lavalinkTrack.info.artworkUrl;
        if (!track.duration && lavalinkTrack.info.length) {
          track.duration = Math.floor(lavalinkTrack.info.length / 1000);
          track.durationStr = formatDuration(track.duration);
        }
      }

      await this.lavalinkPlayer.playTrack({ track: { encoded } });

      logger.info('[Lavalink] Playing: %s', track.title);

      await this.updateNowPlaying();
      this.persistState();
    } catch (err) {
      logger.error({ err }, '[Lavalink] Failed to play: %s', track.title);
      this.isPlaying = false;
      this.currentTrack = null;
      this.textChannel.send(`Could not play **${track.title}**, skipping.`).catch(() => undefined);
      await this.playNext();
    }
  }

  pause(): boolean {
    if (this._pauseStart || !this.lavalinkPlayer) return false;
    this.lavalinkPlayer.setPaused(true);
    this._pauseStart = Date.now();
    return true;
  }

  resume(): boolean {
    if (!this._pauseStart || !this.lavalinkPlayer) return false;
    this.lavalinkPlayer.setPaused(false);
    this._pauseStart = null;
    return true;
  }

  skip(): void {
    if (this.lavalinkPlayer) {
      this.lavalinkPlayer.stopTrack();
    }
  }

  async setVolume(level: number): Promise<boolean> {
    this.volume = level;
    if (!this.lavalinkPlayer) return false;
    await this.lavalinkPlayer.setGlobalVolume(level);
    return true;
  }

  async seekTo(seconds: number): Promise<void> {
    if (!this.lavalinkPlayer) throw new Error('No player');
    await this.lavalinkPlayer.seekTo(seconds * 1000);
  }

  async setFilter(type: string): Promise<void> {
    if (!this.lavalinkPlayer) throw new Error('No player');
    this.activeFilter = type;
    const preset = FILTER_PRESETS[type] ?? {};
    await this.lavalinkPlayer.setFilters(preset);
  }

  getPlaybackDuration(): number {
    if (!this.lavalinkPlayer) return 0;
    return Math.floor(this.lavalinkPlayer.position / 1000);
  }

  // ── Queue management ───────────────────────────────────────────────────────

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
    this.shuffled = true;
  }

  getTextChannel(): TextChannel { return this.textChannel; }
  getActiveFilter(): string { return this.activeFilter; }

  // ── Autoplay ───────────────────────────────────────────────────────────────

  private async resolveAutoplay(lastTrack: Track): Promise<void> {
    if (!this.lavalinkPlayer) { this.scheduleDestroy(); return; }

    try {
      const query = `${lastTrack.title} similar music`;
      const node = this.lavalinkPlayer.node;

      // SoundCloud first (YouTube is currently broken), then YouTube as fallback
      let result = await node.rest.resolve(`scsearch:${query}`);
      if (!result || result.loadType !== 'search') {
        result = await node.rest.resolve(`ytsearch:${query}`);
      }

      if (!result || result.loadType !== 'search') { this.scheduleDestroy(); return; }

      const entries = result.data as LavalinkTrack[];
      const filtered = entries.filter((e) => e.info.uri !== lastTrack.url && e.info.title !== lastTrack.title);
      const pick = filtered[Math.floor(Math.random() * filtered.length)] ?? entries[0];
      if (!pick) { this.scheduleDestroy(); return; }

      const track: Track = {
        title:       pick.info.title,
        artist:      pick.info.author ?? null,
        url:         pick.info.uri ?? '',
        playUrl:     pick.info.uri ?? '',
        encoded:     pick.encoded,
        duration:    Math.floor(pick.info.length / 1000),
        durationStr: formatDuration(Math.floor(pick.info.length / 1000)),
        thumbnail:   pick.info.artworkUrl ?? null,
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

  // ── Destroy ────────────────────────────────────────────────────────────────

  destroy(): void {
    this.cancelDestroyTimer();
    this.disableNowPlaying();
    this.tracks = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.activeFilter = 'none';
    deleteQueueState(this.guildId);

    if (this.lavalinkPlayer) {
      const shoukaku = getShoukaku();
      shoukaku.leaveVoiceChannel(this.guildId);
      this.lavalinkPlayer = null;
    }
  }

  // ── Persistent Now Playing UI ──────────────────────────────────────────────

  private buildNowPlayingEmbed(): EmbedBuilder {
    const track = this.currentTrack;
    if (!track) return new EmbedBuilder().setColor(0x5865f2).setDescription('No track playing.');

    const isPaused = !!this._pauseStart;

    const embed = new EmbedBuilder()
      .setColor(sourceColor(track.source))
      .setAuthor({ name: isPaused ? '\u23F8 Paused' : '\u25B6 Now Playing' })
      .setTitle(track.title)
      .setURL(track.url);

    if (track.artist) embed.addFields({ name: 'Artist', value: track.artist, inline: true });
    embed.addFields(
      { name: 'Duration', value: track.durationStr, inline: true },
      { name: 'Requested by', value: track.requestedBy, inline: true },
    );
    if (track.album) embed.addFields({ name: 'Album', value: track.album, inline: true });
    if (track.uploadDate) embed.addFields({ name: 'Released', value: track.uploadDate, inline: true });
    if (this.tracks.length > 0) {
      const MAX_QUEUE_DISPLAY = 10;
      const listed = this.tracks.slice(0, MAX_QUEUE_DISPLAY);
      const lines = listed.map((t, i) => `\`${i + 1}.\` ${t.title}`);
      if (this.tracks.length > MAX_QUEUE_DISPLAY) lines.push(`*+${this.tracks.length - MAX_QUEUE_DISPLAY} more...*`);
      const queueStr = lines.join('\n');
      embed.addFields({ name: `Queue (${this.tracks.length})`, value: queueStr.slice(0, 1024) });
    } else {
      embed.addFields({ name: 'Queue', value: 'Empty', inline: true });
    }
    const sourceLabels: Record<string, string> = {
      spotify: 'Spotify', soundcloud: 'SoundCloud', youtube: 'YouTube', autoplay: 'Autoplay',
    };
    const sourceLabel = sourceLabels[track.source] ?? track.source.charAt(0).toUpperCase() + track.source.slice(1);
    embed.addFields({ name: 'Source', value: sourceLabel, inline: true });

    const tags: string[] = [`Volume: ${this.volume}%`];
    if (this.loopMode !== 'off') tags.push(`Loop: ${this.loopMode}`);
    if (this.shuffled) tags.push('Shuffled');
    if (this.autoplay) tags.push('Autoplay');
    if (this.activeFilter !== 'none') tags.push(`Filter: ${this.activeFilter}`);
    embed.setFooter({ text: tags.join(' | ') });

    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    return embed;
  }

  private buildPlayerComponents(): ActionRowBuilder[] {
    const isPaused = !!this._pauseStart;
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('player_previous').setEmoji('\u23EE').setStyle(ButtonStyle.Secondary).setDisabled(this.history.length === 0),
      new ButtonBuilder().setCustomId('player_pauseresume').setEmoji(isPaused ? '\u25B6' : '\u23F8').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('player_skip').setEmoji('\u23ED').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('player_stop').setEmoji('\u23F9').setStyle(ButtonStyle.Danger),
      (() => {
        const btn = new ButtonBuilder().setCustomId('player_loop').setEmoji('\uD83D\uDD01').setStyle(this.loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary);
        if (this.loopMode !== 'off') btn.setLabel(this.loopMode);
        return btn;
      })(),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('player_shuffle').setEmoji('\uD83D\uDD00').setStyle(this.shuffled ? ButtonStyle.Success : ButtonStyle.Secondary),
      (() => {
        const btn = new ButtonBuilder().setCustomId('player_autoplay').setEmoji('\u267E').setStyle(this.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary);
        if (this.autoplay) btn.setLabel('autoplay');
        return btn;
      })(),
      new ButtonBuilder().setCustomId('player_voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(this.volume <= 0),
      new ButtonBuilder().setCustomId('player_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(this.volume >= 100),
    );

    const FILTER_OPTIONS = [
      { label: 'None (reset)',       value: 'none',          emoji: '❌' },
      { label: 'Bass Boost',         value: 'bassboost',     emoji: '🔊' },
      { label: 'Nightcore',          value: 'nightcore',     emoji: '🌙' },
      { label: 'Vaporwave',          value: 'vaporwave',     emoji: '🌊' },
      { label: '8D Audio',           value: '8d',            emoji: '🎧' },
      { label: 'Slowed + Reverb',    value: 'slowed_reverb', emoji: '🐌' },
      { label: 'Speed Up + Reverb',  value: 'speed_reverb',  emoji: '⚡' },
      { label: 'Treble Boost',       value: 'treble',        emoji: '🔔' },
      { label: 'Karaoke',            value: 'karaoke',       emoji: '🎤' },
      { label: 'Deep Bass',          value: 'deepbass',      emoji: '💥' },
      { label: 'Chipmunk',           value: 'chipmunk',      emoji: '🐿️' },
    ];

    const filterMenu = new StringSelectMenuBuilder()
      .setCustomId('player_filter')
      .setPlaceholder(this.activeFilter === 'none' ? '🎛️ Audio Filters' : `🎛️ Filter: ${this.activeFilter}`)
      .addOptions(FILTER_OPTIONS.map((o) => ({
        ...o,
        default: o.value === this.activeFilter,
      })));

    const row3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(filterMenu);

    return [row1, row2, row3];
  }

  async updateNowPlaying(): Promise<void> {
    const embed = this.buildNowPlayingEmbed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components = this.buildPlayerComponents() as any[];
    try {
      if (this.nowPlayingMessage) {
        await this.nowPlayingMessage.edit({ embeds: [embed], components }).catch(() => { this.nowPlayingMessage = null; });
      }
      if (!this.nowPlayingMessage) {
        this.nowPlayingMessage = await this.textChannel.send({ embeds: [embed], components });
        this.setupButtonCollector();
      }
    } catch { /* Channel may be deleted */ }
  }

  private disableNowPlaying(): void {
    if (this.nowPlayingMessage) {
      this.nowPlayingMessage.edit({ components: [] }).catch(() => undefined);
      this.nowPlayingMessage = null;
    }
  }

  private setupButtonCollector(): void {
    if (!this.nowPlayingMessage) return;
    const collector = this.nowPlayingMessage.createMessageComponentCollector({ time: 86_400_000 });

    collector.on('collect', async (interaction) => {
      try {
        // Handle select menu (filter)
        if (interaction.isStringSelectMenu() && interaction.customId === 'player_filter') {
          const selected = interaction.values[0] ?? 'none';
          await this.setFilter(selected);
          await this.updateNowPlaying();
          await interaction.deferUpdate();
          return;
        }

        if (!interaction.isButton()) { await interaction.deferUpdate(); return; }

        switch (interaction.customId) {
          case 'player_pauseresume':
            if (this._pauseStart) this.resume(); else this.pause();
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          case 'player_skip':
            this.skip();
            await interaction.deferUpdate();
            break;
          case 'player_stop':
            this.destroy();
            await interaction.deferUpdate();
            break;
          case 'player_loop': {
            const modes: LoopMode[] = ['off', 'track', 'queue'];
            this.loopMode = modes[(modes.indexOf(this.loopMode) + 1) % modes.length]!;
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          }
          case 'player_shuffle':
            if (this.shuffled) this.shuffled = false; else this.shuffle();
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          case 'player_previous':
            if (this.history.length > 0) { this.tracks.unshift(this.history.shift()!); this.skip(); }
            await interaction.deferUpdate();
            break;
          case 'player_autoplay':
            this.autoplay = !this.autoplay;
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          case 'player_voldown':
            this.setVolume(Math.max(0, this.volume - 10));
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          case 'player_volup':
            this.setVolume(Math.min(100, this.volume + 10));
            await this.updateNowPlaying();
            await interaction.deferUpdate();
            break;
          default:
            await interaction.deferUpdate();
        }
      } catch { /* expired interaction or already replied — safe to ignore */ }
    });

    collector.on('end', () => { this.disableNowPlaying(); });
  }

  // ── Persistence ────────────────────────────────────────────────────────────

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

  private scheduleDestroy(): void {
    if (this.stayConnected) return;
    this.cancelDestroyTimer();
    const IDLE_TIMEOUT = 5 * 60_000;
    this.destroyTimer = setTimeout(() => {
      this.destroy();
      this.textChannel.send('No music for 5 minutes \u2014 disconnected.').catch(() => undefined);
    }, IDLE_TIMEOUT);
  }

  private cancelDestroyTimer(): void {
    if (this.destroyTimer) { clearTimeout(this.destroyTimer); this.destroyTimer = null; }
  }
}
