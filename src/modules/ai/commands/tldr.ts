import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask, NetworkError, SafetyError, RateLimitError, DailyLimitError } from '../router';
import { logger } from '../../../services/logger';

const tldr: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('tldr')
    .setDescription('Summarize a webpage with AI')
    .addStringOption((opt) =>
      opt.setName('url').setDescription('URL of the webpage to summarize').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true).trim();

    if (!/^https?:\/\//i.test(url)) {
      await interaction.reply({ content: 'Invalid URL — must start with http:// or https://.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ArklayBot/1.0 (Discord TLDR)' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        await interaction.editReply(`Failed to fetch the page (HTTP ${res.status}).`);
        return;
      }

      const html = await res.text();

      // Strip HTML tags and collapse whitespace
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);

      if (text.length < 50) {
        await interaction.editReply('Could not extract enough text from that page.');
        return;
      }

      const prompt = `Summarize this webpage content in 3-5 bullet points. Be concise.\n\n${text}`;
      const result = await ask(
        interaction.guildId ?? 'dm',
        interaction.user.id,
        prompt,
        'auto',
      );

      const summary = result.text.length > 4000 ? result.text.slice(0, 3997) + '...' : result.text;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('TL;DR')
        .setDescription(summary)
        .addFields({ name: 'Source', value: url })
        .setFooter({ text: `Powered by ${result.provider}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, '/tldr failed for %s', url);
      await interaction.editReply(errorMessage(err));
    }
  },
};

function errorMessage(err: unknown): string {
  if (err instanceof DailyLimitError) return `Daily limit reached for **${err.model}**.`;
  if (err instanceof RateLimitError) return 'Too many requests, please try again in a few seconds.';
  if (err instanceof SafetyError) return 'This request could not be processed.';
  if (err instanceof NetworkError) return 'The AI service is temporarily unavailable.';
  if (err instanceof TypeError && (err as Error).message.includes('fetch')) {
    return 'Could not reach that URL.';
  }
  return 'Something went wrong while summarizing.';
}

export default tldr;
