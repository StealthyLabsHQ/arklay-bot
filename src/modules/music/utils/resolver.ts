import ytDlp from 'yt-dlp-exec';
import type { Track } from '../structures/GuildQueue';
import { formatDuration } from '../structures/GuildQueue';

// ── Source detection ──────────────────────────────────────────────────────────

const SPOTIFY_REGEX = {
  track:    /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/,
  playlist: /open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]+)/,
  album:    /open\.spotify\.com\/(?:intl-[a-z]+\/)?album\/([A-Za-z0-9]+)/,
};

type Source =
  | 'youtube' | 'youtube_playlist'
  | 'soundcloud'
  | 'spotify_track' | 'spotify_playlist' | 'spotify_album'
  | 'search';

function detectSource(input: string): Source {
  // YouTube watch URL with list= param (Mix, playlist link) → treat as playlist
  if (/youtube\.com\/watch.*[?&]list=/i.test(input))        return 'youtube_playlist';
  if (/youtu\.be\/|youtube\.com\/watch/i.test(input))       return 'youtube';
  if (/youtube\.com\/playlist\?list=/i.test(input))         return 'youtube_playlist';
  if (/soundcloud\.com\//i.test(input))                     return 'soundcloud';
  if (SPOTIFY_REGEX.track.test(input))                      return 'spotify_track';
  if (SPOTIFY_REGEX.playlist.test(input))                   return 'spotify_playlist';
  if (SPOTIFY_REGEX.album.test(input))                      return 'spotify_album';
  return 'search';
}

// ── yt-dlp helpers ────────────────────────────────────────────────────────────

interface YtDlpEntry {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url: string }>;
  entries?: YtDlpEntry[];
  // flat playlist / search may return only these
  ie_key?: string;
}

import { existsSync } from 'fs';
import path from 'path';

const COOKIES_FILE = path.join(process.cwd(), 'cookies.txt');

const YT_DLP_BASE = {
  dumpSingleJson: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
} as const;

function getYtDlpOpts(withAudioUrl: boolean): Record<string, unknown> {
  const opts: Record<string, unknown> = { ...YT_DLP_BASE };
  if (withAudioUrl) {
    opts['format'] = 'bestaudio[abr>=192]/bestaudio[acodec=opus]/bestaudio/best';
  }
  if (existsSync(COOKIES_FILE)) opts['cookies'] = COOKIES_FILE;
  return opts;
}

function trackFromYtDlp(data: YtDlpEntry, source: string, requestedBy: string): Track {
  const duration = data.duration ?? null;
  const webpageUrl =
    data.webpage_url ??
    (data.id ? `https://www.youtube.com/watch?v=${data.id}` : null) ??
    data.url ??
    '';
  // If yt-dlp returned a direct audio URL, store it in audioUrl for instant playback
  const directAudioUrl = data.url && data.url !== webpageUrl ? data.url : null;
  return {
    title:       data.title     ?? 'Unknown title',
    url:         webpageUrl,
    playUrl:     webpageUrl,
    audioUrl:    directAudioUrl,
    duration,
    durationStr: formatDuration(duration),
    thumbnail:   data.thumbnail ?? data.thumbnails?.[0]?.url ?? null,
    source,
    requestedBy,
  };
}

async function resolveViaYtDlp(query: string, source: string, requestedBy: string, withAudioUrl = true): Promise<Track> {
  const isUrl  = /^https?:\/\//i.test(query);
  const target = isUrl ? query : `ytsearch1:${query}`;
  const info   = await (ytDlp as unknown as (url: string, opts: object) => Promise<YtDlpEntry>)(target, getYtDlpOpts(withAudioUrl));
  const data   = info.entries?.length ? info.entries[0]! : info;
  if (!data || (!data.title && !data.url && !data.id)) {
    throw new Error(`No results found for: ${query}`);
  }
  return trackFromYtDlp(data, source, requestedBy);
}

async function resolveYoutubePlaylist(url: string, requestedBy: string): Promise<Track[]> {
  const info = await (ytDlp as unknown as (url: string, opts: object) => Promise<YtDlpEntry>)(
    url, { ...YT_DLP_BASE, flatPlaylist: true }
  );
  if (!info.entries?.length) throw new Error('Empty or inaccessible playlist.');
  return info.entries.map((e) => ({
    title:       e.title       ?? 'Unknown title',
    url:         e.url         ?? `https://www.youtube.com/watch?v=${e.id}`,
    playUrl:     e.url         ?? `https://www.youtube.com/watch?v=${e.id}`,
    duration:    e.duration    ?? null,
    durationStr: formatDuration(e.duration ?? null),
    thumbnail:   e.thumbnails?.[0]?.url ?? null,
    source:      'youtube',
    requestedBy,
  }));
}

// ── Spotify ───────────────────────────────────────────────────────────────────

const SPOTIFY_API   = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

let _spotifyToken: string | null = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;

  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET');

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res   = await fetch(SPOTIFY_TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  _spotifyToken       = json.access_token;
  _spotifyTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _spotifyToken;
}

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getSpotifyToken();
  const res   = await fetch(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface SpotifyTrackRaw {
  name: string;
  artists?: Array<{ name: string }>;
  duration_ms?: number;
  album?: { images?: Array<{ url: string }> };
}

export async function spotifyTrackToYT(raw: SpotifyTrackRaw, requestedBy: string, withAudioUrl = true): Promise<Track> {
  const artist   = raw.artists?.[0]?.name ?? '';
  const query    = `${artist} ${raw.name}`.trim();
  const albumArt = raw.album?.images?.[0]?.url ?? null;
  const yt       = await resolveViaYtDlp(query, 'youtube', requestedBy, withAudioUrl);
  return {
    ...yt,
    title:    `${artist ? artist + ' - ' : ''}${raw.name}`,
    thumbnail: albumArt ?? yt.thumbnail,
    source:   'spotify',
  };
}

function hasSpotifyCredentials(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

interface SpotifyOEmbed { title?: string; thumbnail_url?: string }

async function spotifyTrackViaOEmbed(url: string, requestedBy: string): Promise<Track> {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Spotify oEmbed failed: ${res.status}`);
  const data = await res.json() as SpotifyOEmbed;
  const title = data.title ?? 'Unknown track';
  const yt = await resolveViaYtDlp(title, 'youtube', requestedBy);
  return {
    ...yt,
    title,
    thumbnail: data.thumbnail_url ?? yt.thumbnail,
    source: 'spotify',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ResolveResult {
  tracks: Track[];
  isPlaylist: boolean;
  playlistTitle?: string;
}

export async function resolve(query: string, requestedBy: string): Promise<ResolveResult> {
  const src = detectSource(query);

  if (src === 'youtube')    return { tracks: [await resolveViaYtDlp(query, 'youtube', requestedBy)],    isPlaylist: false };
  if (src === 'soundcloud') return { tracks: [await resolveViaYtDlp(query, 'soundcloud', requestedBy)], isPlaylist: false };
  if (src === 'search')     return { tracks: [await resolveViaYtDlp(query, 'search', requestedBy)],     isPlaylist: false };

  if (src === 'spotify_track') {
    if (hasSpotifyCredentials()) {
      const [, id] = query.match(SPOTIFY_REGEX.track)!;
      const raw    = await spotifyGet<SpotifyTrackRaw>(`/tracks/${id!}`);
      return { tracks: [await spotifyTrackToYT(raw, requestedBy)], isPlaylist: false };
    }
    // Fallback: oEmbed (no API key needed)
    return { tracks: [await spotifyTrackViaOEmbed(query, requestedBy)], isPlaylist: false };
  }

  if (src === 'youtube_playlist') {
    const tracks = await resolveYoutubePlaylist(query, requestedBy);
    return { tracks, isPlaylist: true, playlistTitle: 'YouTube Playlist' };
  }

  if (src === 'spotify_playlist') {
    if (!hasSpotifyCredentials()) throw new Error('Spotify playlists require SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
    const [, id] = query.match(SPOTIFY_REGEX.playlist)!;
    const info   = await spotifyGet<{ name?: string }>(`/playlists/${id!}?fields=name`);
    const items  = await resolveSpotifyPlaylistTracks(id!);
    const tracks = await resolveSpotifyBatch(items, requestedBy);
    return { tracks, isPlaylist: true, playlistTitle: info.name ?? 'Spotify Playlist' };
  }

  if (src === 'spotify_album') {
    if (!hasSpotifyCredentials()) throw new Error('Spotify albums require SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
    const [, id] = query.match(SPOTIFY_REGEX.album)!;
    const info   = await spotifyGet<{ name?: string; images?: Array<{ url: string }> }>(`/albums/${id!}`);
    const items  = await resolveSpotifyAlbumTracks(id!, info.images ?? []);
    const tracks = await resolveSpotifyBatch(items, requestedBy);
    return { tracks, isPlaylist: true, playlistTitle: info.name ?? 'Spotify Album' };
  }

  return { tracks: [await resolveViaYtDlp(query, 'search', requestedBy)], isPlaylist: false };
}

interface SpotifyPlaylistPage { next?: string; items?: Array<{ track: SpotifyTrackRaw }> }
interface SpotifyAlbumPage   { next?: string; items?: SpotifyTrackRaw[] }

async function resolveSpotifyPlaylistTracks(id: string): Promise<SpotifyTrackRaw[]> {
  const tracks: SpotifyTrackRaw[] = [];
  let url: string | null = `/playlists/${id}/tracks?limit=100&fields=next,items(track(name,artists,duration_ms,album(images)))`;
  while (url) {
    const page: SpotifyPlaylistPage = await spotifyGet<SpotifyPlaylistPage>(url);
    for (const item of page.items ?? []) {
      if (item.track?.name) tracks.push(item.track);
    }
    url = page.next ? page.next.replace(SPOTIFY_API, '') : null;
  }
  return tracks;
}

async function resolveSpotifyAlbumTracks(id: string, images: Array<{ url: string }>): Promise<SpotifyTrackRaw[]> {
  const tracks: SpotifyTrackRaw[] = [];
  let url: string | null = `/albums/${id}/tracks?limit=50`;
  while (url) {
    const page: SpotifyAlbumPage = await spotifyGet<SpotifyAlbumPage>(url);
    for (const t of page.items ?? []) {
      tracks.push({ ...t, album: { images } });
    }
    url = page.next ? page.next.replace(SPOTIFY_API, '') : null;
  }
  return tracks;
}

async function resolveSpotifyBatch(items: SpotifyTrackRaw[], requestedBy: string): Promise<Track[]> {
  const results: Track[] = [];
  const CHUNK = 5;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk    = items.slice(i, i + CHUNK);
    // Only resolve audio URL for the very first track (instant playback), rest = metadata only (pre-fetch handles them)
    const resolved = await Promise.allSettled(
      chunk.map((t, j) => spotifyTrackToYT(t, requestedBy, i === 0 && j === 0))
    );
    for (const r of resolved) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}
