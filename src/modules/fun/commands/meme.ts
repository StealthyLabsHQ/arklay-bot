import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { logger } from '../../../services/logger';

const SUBREDDITS = ['memes', 'dankmemes', 'me_irl', 'meme', 'wholesomememes'];
const IMGFLIP_API_URL = 'https://api.imgflip.com/get_memes';

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  ups: number;
  is_video: boolean;
  post_hint?: string;
}

interface MemeCandidate {
  title: string;
  imageUrl: string;
  postUrl?: string;
  footer: string;
}

interface ImgflipMeme {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
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

function scoreSearch(title: string, search: string): number {
  const terms = search.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  if (terms.length === 0) return 0;

  const lowerTitle = title.toLowerCase();
  return terms.reduce((score, term) => score + (lowerTitle.includes(term) ? 1 : 0), 0);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

async function fetchReddit(url: string): Promise<{ data: { children: Array<{ data: RedditPost }> } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Reddit returned ${res.status}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Reddit returned non-JSON content (${contentType || 'unknown'})`);
    }

    const json = await res.json();

    // Reddit search returns array, subreddit returns object
    if (Array.isArray(json)) {
      return json[0] as { data: { children: Array<{ data: RedditPost }> } };
    }
    return json as { data: { children: Array<{ data: RedditPost }> } };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRedditMemes(search: string | null): Promise<MemeCandidate[]> {
  let url: string;
  let footerPrefix: string;

  if (search) {
    const encoded = encodeURIComponent(search + ' meme');
    url = `https://www.reddit.com/search.json?q=${encoded}&sort=relevance&t=all&limit=100&type=link`;
    footerPrefix = `Reddit search: "${search}"`;
  } else {
    const sub = pickRandom(SUBREDDITS);
    url = `https://www.reddit.com/r/${sub}/hot.json?limit=50`;
    footerPrefix = `r/${sub}`;
  }

  const json = await fetchReddit(url);

  return json.data.children
    .map((child) => child.data)
    .filter((post) => !post.is_video && (post.post_hint === 'image' || isImageUrl(post.url)))
    .map((post) => ({
      title: post.title,
      imageUrl: post.url,
      postUrl: `https://reddit.com${post.permalink}`,
      footer: `${footerPrefix} • ${post.ups} upvotes`,
    }));
}

async function fetchImgflipMemes(search: string | null): Promise<MemeCandidate[]> {
  const res = await fetch(IMGFLIP_API_URL, {
    headers: { 'User-Agent': 'ArklayBot/1.0 (+https://github.com/StealthyLabsHQ/arklay-bot)' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Imgflip returned ${res.status}`);
  }

  const json = await res.json() as { success?: boolean; data?: { memes?: ImgflipMeme[] } };
  const memes = json.data?.memes ?? [];
  if (!json.success || memes.length === 0) {
    throw new Error('Imgflip returned no memes');
  }

  const filtered = memes.filter((meme) => isImageUrl(meme.url));
  if (!search) {
    return filtered.map((meme) => ({
      title: meme.name,
      imageUrl: meme.url,
      footer: 'Imgflip fallback',
    }));
  }

  const ranked = filtered
    .map((meme) => ({ meme, score: scoreSearch(meme.name, search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(({ meme }) => ({
      title: meme.name,
      imageUrl: meme.url,
      footer: `Imgflip fallback • search: "${search}"`,
    }));

  return ranked.length > 0 ? ranked : filtered.slice(0, 25).map((meme) => ({
    title: meme.name,
    imageUrl: meme.url,
    footer: `Imgflip fallback • broad match for "${search}"`,
  }));
}

async function resolveMeme(search: string | null): Promise<MemeCandidate> {
  try {
    const redditMemes = await fetchRedditMemes(search);
    if (redditMemes.length > 0) {
      return pickRandom(redditMemes);
    }
  } catch (err) {
    logger.warn({ err }, '/meme: Reddit source failed, falling back to Imgflip');
  }

  const fallbackMemes = await fetchImgflipMemes(search);
  if (fallbackMemes.length === 0) {
    throw new Error('No memes available from any source');
  }

  return pickRandom(fallbackMemes);
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
      await interaction.editReply('Could not fetch meme right now. Try again in a moment.');
    }
  },
};

export default meme;
