import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { logger } from '../../../services/logger';

const GIPHY_KEY = process.env.GIPHY_API_KEY ?? '';
const SUBREDDITS = ['memes', 'dankmemes', 'me_irl', 'meme', 'wholesomememes'];

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  ups: number;
  is_video: boolean;
  post_hint?: string;
  over_18?: boolean;
}

interface MemeCandidate {
  title: string;
  imageUrl: string;
  postUrl?: string;
  footer: string;
}

// Realistic browser User-Agent to avoid Reddit blocking VPS IPs
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

async function fetchReddit(url: string): Promise<{ data: { children: Array<{ data: RedditPost }> } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Reddit returned ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Reddit returned non-JSON (${contentType || 'unknown'})`);
    }

    const json = await res.json();
    if (Array.isArray(json)) return json[0] as { data: { children: Array<{ data: RedditPost }> } };
    return json as { data: { children: Array<{ data: RedditPost }> } };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRedditMemes(search: string | null): Promise<MemeCandidate[]> {
  let url: string;
  let footerPrefix: string;

  if (search) {
    const encoded = encodeURIComponent(`${search} meme`);
    url = `https://www.reddit.com/search.json?q=${encoded}&sort=relevance&t=all&limit=100&type=link`;
    footerPrefix = `Reddit • "${search}"`;
  } else {
    const sub = pickRandom(SUBREDDITS);
    url = `https://www.reddit.com/r/${sub}/hot.json?limit=50`;
    footerPrefix = `r/${sub}`;
  }

  const json = await fetchReddit(url);

  return json.data.children
    .map((child) => child.data)
    .filter((post) => !post.is_video && !post.over_18 && (post.post_hint === 'image' || isImageUrl(post.url)))
    .map((post) => ({
      title: post.title,
      imageUrl: post.url,
      postUrl: `https://reddit.com${post.permalink}`,
      footer: `${footerPrefix} • ${post.ups} upvotes`,
    }));
}

// Giphy fallback for search queries — works from any VPS IP
async function fetchGiphyMemes(search: string): Promise<MemeCandidate[]> {
  if (!GIPHY_KEY) throw new Error('GIPHY_API_KEY not configured');

  const encoded = encodeURIComponent(`${search} meme`);
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encoded}&limit=25&rating=pg`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Giphy returned ${res.status}`);

  const json = await res.json() as {
    data: Array<{ title: string; images?: { original?: { url: string } } }>;
  };

  return (json.data ?? [])
    .map((gif) => ({
      title: gif.title || search,
      imageUrl: gif.images?.original?.url ?? '',
      footer: `Giphy • "${search}"`,
    }))
    .filter((m) => m.imageUrl.length > 0);
}

// meme-api.com fallback for random memes — Reddit proxy, bypasses VPS IP blocks
async function fetchMemeApiRandom(): Promise<MemeCandidate[]> {
  const res = await fetch('https://meme-api.com/gimme/20', { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`meme-api returned ${res.status}`);

  const json = await res.json() as {
    memes: Array<{ title: string; url: string; postLink: string; ups: number; nsfw: boolean }>;
  };

  return (json.memes ?? [])
    .filter((m) => !m.nsfw && isImageUrl(m.url))
    .map((m) => ({
      title: m.title,
      imageUrl: m.url,
      postUrl: m.postLink,
      footer: `Reddit • ${m.ups} upvotes`,
    }));
}

async function resolveMeme(search: string | null): Promise<MemeCandidate> {
  // Try Reddit first (works on some hosts and locally)
  try {
    const redditMemes = await fetchRedditMemes(search);
    if (redditMemes.length > 0) return pickRandom(redditMemes);
  } catch (err) {
    logger.warn({ err }, '/meme: Reddit failed, trying fallback');
  }

  if (search) {
    // Search fallback: Giphy returns topically relevant results
    try {
      const giphyMemes = await fetchGiphyMemes(search);
      if (giphyMemes.length > 0) return pickRandom(giphyMemes);
    } catch (err) {
      logger.warn({ err }, '/meme: Giphy failed');
    }
    throw new Error(`No memes found for "${search}"`);
  }

  // Random fallback: meme-api.com (Reddit proxy, no auth needed)
  try {
    const apiMemes = await fetchMemeApiRandom();
    if (apiMemes.length > 0) return pickRandom(apiMemes);
  } catch (err) {
    logger.warn({ err }, '/meme: meme-api.com failed');
  }

  throw new Error('No memes available from any source');
}

const meme: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme')
    .addStringOption((opt) =>
      opt.setName('search').setDescription('Search for a specific meme topic').setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const search = interaction.options.getString('search');

    try {
      const memeResult = await resolveMeme(search);

      const embed = new EmbedBuilder()
        .setColor(0xff5700)
        .setTitle(memeResult.title.slice(0, 256))
        .setImage(memeResult.imageUrl)
        .setFooter({ text: memeResult.footer });

      if (memeResult.postUrl) {
        embed.setURL(memeResult.postUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.warn({ err }, '/meme failed');
      const msg = err instanceof Error && err.message.includes('No memes found')
        ? `No memes found for that search. Try different keywords.`
        : 'Could not fetch meme right now. Try again in a moment.';
      await interaction.editReply(msg);
    }
  },
};

export default meme;
