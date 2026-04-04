import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

interface CoinGeckoPrice {
  [id: string]: { usd: number; usd_24h_change?: number; usd_market_cap?: number };
}

const COINS: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', cardano: 'ADA',
  dogecoin: 'DOGE', ripple: 'XRP', polkadot: 'DOT', litecoin: 'LTC',
};

const crypto: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Get current cryptocurrency prices')
    .addStringOption((opt) =>
      opt.setName('coin').setDescription('Cryptocurrency').setRequired(false)
        .addChoices(
          ...Object.entries(COINS).map(([id, symbol]) => ({ name: `${symbol} (${id})`, value: id }))
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const coin = interaction.options.getString('coin') ?? 'bitcoin';

    try {
      const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
      const data = await res.json() as CoinGeckoPrice;

      const info = data[coin];
      if (!info) {
        await interaction.editReply('Coin not found.');
        return;
      }

      const change = info.usd_24h_change ?? 0;
      const symbol = COINS[coin] ?? coin.toUpperCase();

      const embed = new EmbedBuilder()
        .setColor(change >= 0 ? 0x57f287 : 0xed4245)
        .setTitle(`${symbol} - $${info.usd.toLocaleString('en-US', { maximumFractionDigits: 6 })}`)
        .addFields(
          { name: '24h Change', value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, inline: true },
          { name: 'Market Cap', value: info.usd_market_cap ? `$${(info.usd_market_cap / 1e9).toFixed(2)}B` : 'N/A', inline: true },
        )
        .setFooter({ text: 'Data from CoinGecko' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Could not fetch crypto prices.');
    }
  },
};

export default crypto;
