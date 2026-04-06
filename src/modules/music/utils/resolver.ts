import type { Track as LavalinkTrack } from 'shoukaku';
import type { Track } from '../structures/GuildQueue';
import { formatDuration } from '../structures/GuildQueue';
import { getShoukaku } from '../../../services/lavalink';

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
  if (/youtube\.com\/watch.*[?&]list=/i.test(input))        return 'youtube_playlist';
  if (/youtu\.be\/|youtube\.com\/watch/i.test(input))       return 'youtube';
  if (/youtube\.com\/playlist\?list=/i.test(input))         return 'youtube_playlist';
  if (/soundcloud\.com\//i.test(input))                     return 'soundcloud';
  if (SPOTIFY_REGEX.track.test(input))                      return 'spotify_track';
  if (SPOTIFY_REGEX.playlist.test(input))                   return 'spotify_playlist';
  if (SPOTIFY_REGEX.album.test(input))                      return 'spotify_album';
  return 'search';
}

// ── Lavalink helpers ─────────────────────────────────────────────────────────

function getNode() {
  const shoukaku = getShoukaku();
  const node = shoukaku.options.nodeResolver(shoukaku.nodes);
  if (!node) throw new Error('No Lavalink node available');
  return node;
}

function detectLavalinkSource(lt: LavalinkTrack): string {
  const name = (lt.info as Record<string, unknown>).sourceName as string | undefined;
  if (name) {
    const n = name.toLowerCase();
    if (n.includes('soundcloud')) return 'soundcloud';
    if (n.includes('youtube'))    return 'youtube';
    if (n.includes('spotify'))    return 'spotify';
    return n;
  }
  const uri = lt.info.uri ?? '';
  if (uri.includes('soundcloud.com')) return 'soundcloud';
  if (uri.includes('youtube.com') || uri.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

function trackFromLavalink(lt: LavalinkTrack, sourceOverride: string | null, requestedBy: string): Track {
  const duration = lt.info.length ? Math.floor(lt.info.length / 1000) : null;
  const source = sourceOverride ?? detectLavalinkSource(lt);
  return {
    title:       lt.info.title,
    artist:      lt.info.author ?? null,
    url:         lt.info.uri ?? '',
    playUrl:     lt.info.uri ?? '',
    encoded:     lt.encoded,
    duration,
    durationStr: formatDuration(duration),
    thumbnail:   lt.info.artworkUrl ?? null,
    source,
    requestedBy,
  };
}

async function resolveViaLavalink(query: string, source: string | null, requestedBy: string): Promise<Track> {
  const node = getNode();
  const isUrl = /^https?:\/\//i.test(query);

  // SoundCloud first (YouTube is currently broken), then YouTube as fallback
  const searchPrefixes = isUrl ? [query] : [`scsearch:${query}`, `ytmsearch:${query}`, `ytsearch:${query}`];

  let result: Awaited<ReturnType<typeof node.rest.resolve>> | null = null;
  for (const search of searchPrefixes) {
    result = await node.rest.resolve(search);
    if (result && result.loadType !== 'empty' && result.loadType !== 'error') break;
    result = null;
  }

  if (!result) {
    throw new Error(`No results found for: ${query}`);
  }

  let lt: LavalinkTrack | undefined;
  if (result.loadType === 'track') {
    lt = result.data as LavalinkTrack;
  } else if (result.loadType === 'search') {
    lt = (result.data as LavalinkTrack[])[0];
  } else if (result.loadType === 'playlist') {
    lt = (result.data as { tracks: LavalinkTrack[] }).tracks[0];
  }

  if (!lt) throw new Error(`No results found for: ${query}`);
  return trackFromLavalink(lt, source, requestedBy);
}

async function resolvePlaylist(url: string, requestedBy: string): Promise<Track[]> {
  const node = getNode();
  const result = await node.rest.resolve(url);

  if (!result || result.loadType !== 'playlist') {
    throw new Error('Empty or inaccessible playlist.');
  }

  const playlist = result.data as { tracks: LavalinkTrack[] };
  return playlist.tracks.map((lt) => trackFromLavalink(lt, null, requestedBy));
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
  album?: { name?: string; images?: Array<{ url: string }> };
}

export async function resolveSpotifyTrack(raw: SpotifyTrackRaw, requestedBy: string): Promise<Track> {
  const artist   = raw.artists?.[0]?.name ?? '';
  const query    = `${artist} ${raw.name}`.trim();
  const albumArt = raw.album?.images?.[0]?.url ?? null;
  const resolved = await resolveViaLavalink(query, null, requestedBy);
  return {
    ...resolved,
    title:     `${artist ? artist + ' - ' : ''}${raw.name}`,
    artist:    artist || resolved.artist,
    album:     raw.album?.name ?? null,
    thumbnail: albumArt ?? resolved.thumbnail,
    source:    'spotify',
  };
}

/** @deprecated Use resolveSpotifyTrack instead */
export const spotifyTrackToYT = resolveSpotifyTrack;

function hasSpotifyCredentials(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

interface SpotifyOEmbed { title?: string; thumbnail_url?: string }

async function spotifyTrackViaOEmbed(url: string, requestedBy: string): Promise<Track> {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Spotify oEmbed failed: ${res.status}`);
  const data = await res.json() as SpotifyOEmbed;
  const title = data.title ?? 'Unknown track';
  const resolved = await resolveViaLavalink(title, null, requestedBy);
  return {
    ...resolved,
    title,
    thumbnail: data.thumbnail_url ?? resolved.thumbnail,
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

  if (src === 'youtube')    return { tracks: [await resolveViaLavalink(query, null, requestedBy)],    isPlaylist: false };
  if (src === 'soundcloud') return { tracks: [await resolveViaLavalink(query, null, requestedBy)], isPlaylist: false };
  if (src === 'search')     return { tracks: [await resolveViaLavalink(query, null, requestedBy)],     isPlaylist: false };

  if (src === 'spotify_track') {
    if (hasSpotifyCredentials()) {
      const [, id] = query.match(SPOTIFY_REGEX.track)!;
      const raw    = await spotifyGet<SpotifyTrackRaw>(`/tracks/${id!}`);
      return { tracks: [await resolveSpotifyTrack(raw, requestedBy)], isPlaylist: false };
    }
    return { tracks: [await spotifyTrackViaOEmbed(query, requestedBy)], isPlaylist: false };
  }

  if (src === 'youtube_playlist') {
    const tracks = await resolvePlaylist(query, requestedBy);
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

  return { tracks: [await resolveViaLavalink(query, null, requestedBy)], isPlaylist: false };
}

interface SpotifyPlaylistPage { next?: string; items?: Array<{ track: SpotifyTrackRaw }> }
interface SpotifyAlbumPage   { next?: string; items?: SpotifyTrackRaw[] }

async function resolveSpotifyPlaylistTracks(id: string): Promise<SpotifyTrackRaw[]> {
  const tracks: SpotifyTrackRaw[] = [];
  const MAX_PAGES = 100;
  let pages = 0;
  let url: string | null = `/playlists/${id}/tracks?limit=100&fields=next,items(track(name,artists,duration_ms,album(name,images)))`;
  while (url && pages < MAX_PAGES) {
    pages++;
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
  const MAX_PAGES = 100;
  let pages = 0;
  let url: string | null = `/albums/${id}/tracks?limit=50`;
  while (url && pages < MAX_PAGES) {
    pages++;
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
    const resolved = await Promise.allSettled(
      chunk.map((t) => resolveSpotifyTrack(t, requestedBy))
    );
    for (const r of resolved) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}
