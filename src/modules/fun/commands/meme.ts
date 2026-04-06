import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { logger } from '../../../services/logger';

const SUBREDDITS = ['memes', 'dankmemes', 'me_irl', 'meme', 'wholesomememes'];

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  ups: number;
  is_video: boolean;
  post_hint?: string;
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

const meme: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme from Reddit')
    .addStringOption((opt) =>
      opt.setName('search').setDescription('Search for a specific meme topic').setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const search = interaction.options.getString('search');

    try {
      let url: string;
      let footerPrefix: string;

      if (search) {
        const encoded = encodeURIComponent(search + ' meme');
        url = `https://www.reddit.com/search.json?q=${encoded}&sort=relevance&t=all&limit=100&type=link`;
        footerPrefix = `Reddit search: "${search}"`;
      } else {
        const sub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)]!;
        url = `https://www.reddit.com/r/${sub}/hot.json?limit=50`;
        footerPrefix = `r/${sub}`;
      }

      const json = await fetchReddit(url);

      const posts = json.data.children
        .map((c) => c.data)
        .filter((p) =>
          !p.is_video &&
          (p.post_hint === 'image' || p.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i))
        );

      if (posts.length === 0) {
        await interaction.editReply(search ? `No memes found for "${search}". Try a different search.` : 'No memes found. Try again.');
        return;
      }

      const post = posts[Math.floor(Math.random() * posts.length)]!;

      const embed = new EmbedBuilder()
        .setColor(0xff5700)
        .setTitle(post.title.slice(0, 256))
        .setURL(`https://reddit.com${post.permalink}`)
        .setImage(post.url)
        .setFooter({ text: `${footerPrefix} \u2022 ${post.ups} upvotes` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.warn({ err }, '/meme: Reddit fetch failed');
      await interaction.editReply('Could not fetch meme. Reddit may be rate limiting — try again in a moment.');
    }
  },
};

export default meme;
