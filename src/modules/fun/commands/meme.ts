import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const SUBREDDITS = ['memes', 'dankmemes', 'me_irl'];

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  ups: number;
  is_video: boolean;
  post_hint?: string;
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

      const res = await fetch(url, {
        headers: { 'User-Agent': 'ArklayBot/1.0' },
      });
      const json = await res.json() as { data: { children: Array<{ data: RedditPost }> } };

      const posts = json.data.children
        .map((c) => c.data)
        .filter((p) => !p.is_video && p.post_hint === 'image');

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
        .setFooter({ text: `${footerPrefix} • ${post.ups} upvotes` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Could not fetch meme. Try again later.');
    }
  },
};

export default meme;
