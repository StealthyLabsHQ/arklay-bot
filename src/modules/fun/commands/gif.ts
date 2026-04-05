import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';

const GIPHY_KEY = process.env.GIPHY_API_KEY || '';
const GIPHY_SEARCH    = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRANSLATE = 'https://api.giphy.com/v1/gifs/translate';
const GIPHY_RANDOM    = 'https://api.giphy.com/v1/gifs/random';

const COOLDOWN_MS = 5_000;

const gif: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Search for a GIF')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('What to search for').setRequired(true).setMaxLength(200)
    )
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Search mode')
        .setRequired(false)
        .addChoices(
          { name: 'Search (top result)', value: 'search' },
          { name: 'Exact match', value: 'exact' },
          { name: 'Random', value: 'random' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('gif', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('gif', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown — try again in ${secs}s.`, ephemeral: true });
      return;
    }

    if (!GIPHY_KEY) {
      await interaction.reply({ content: 'GIF search is not configured (missing GIPHY_API_KEY).', ephemeral: true });
      return;
    }

    const query = interaction.options.getString('query', true);
    const mode = interaction.options.getString('mode') ?? 'search';

    await interaction.deferReply();

    try {
      const encoded = encodeURIComponent(query);
      let gifUrl: string | undefined;

      if (mode === 'random') {
        const url = `${GIPHY_RANDOM}?api_key=${GIPHY_KEY}&tag=${encoded}&rating=g`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Giphy error: ${res.status}`);
        const data = await res.json() as { data: { images?: { original?: { url: string } } } };
        gifUrl = data.data?.images?.original?.url;
      } else if (mode === 'exact') {
        const url = `${GIPHY_TRANSLATE}?api_key=${GIPHY_KEY}&s=${encoded}&rating=g`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Giphy error: ${res.status}`);
        const data = await res.json() as { data: { images?: { original?: { url: string } } } };
        gifUrl = data.data?.images?.original?.url;
      } else {
        const url = `${GIPHY_SEARCH}?api_key=${GIPHY_KEY}&q=${encoded}&limit=1&rating=g`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Giphy error: ${res.status}`);
        const data = await res.json() as { data: Array<{ images?: { original?: { url: string } } }> };
        gifUrl = data.data?.[0]?.images?.original?.url;
      }

      if (!gifUrl) {
        await interaction.editReply(`No GIFs found for "${query}".`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setImage(gifUrl)
        .setFooter({ text: `🔍 "${query}" • Powered by GIPHY` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Could not fetch GIF. Try again later.');
    }
  },
};

export default gif;
