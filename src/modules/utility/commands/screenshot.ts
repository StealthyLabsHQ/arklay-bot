import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { logger } from '../../../services/logger';
import { assertPublicHttpUrl } from '../../../services/safeFetch';

const screenshot: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('screenshot')
    .setDescription('Take a screenshot of a website')
    .addStringOption((opt) =>
      opt.setName('url').setDescription('Website URL (e.g. https://example.com)').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('url', true).trim();

    let targetUrl: URL;
    try {
      targetUrl = await assertPublicHttpUrl(input, { defaultProtocol: 'https:' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid URL.';
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    const url = targetUrl.toString();

    await interaction.deferReply();

    // Try multiple screenshot APIs in order
    const apis = [
      `https://image.thum.io/get/width/1280/crop/720/noanimate/${url}`,
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
    ];

    for (const apiUrl of apis) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';

        // Microlink returns JSON with screenshot URL
        if (contentType.includes('application/json')) {
          const json = await res.json() as { status: string; data?: { screenshot?: { url?: string } } };
          if (json.status === 'success' && json.data?.screenshot?.url) {
            const imgRes = await fetch(json.data.screenshot.url);
            if (!imgRes.ok) continue;
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length < 5000) continue; // blank/error image

            const attachment = new AttachmentBuilder(buf, { name: 'screenshot.png' });
            const embed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle(`Screenshot: ${url.slice(0, 200)}`)
              .setURL(url)
              .setImage('attachment://screenshot.png')
              .setFooter({ text: 'Powered by Microlink' });
            await interaction.editReply({ embeds: [embed], files: [attachment] });
            return;
          }
          continue;
        }

        // Direct image response (thum.io)
        if (contentType.includes('image/')) {
          const buf = Buffer.from(await res.arrayBuffer());
          // Check if image is not blank (blank pages are usually very small)
          if (buf.length < 5000) continue;

          const attachment = new AttachmentBuilder(buf, { name: 'screenshot.png' });
          const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`Screenshot: ${url.slice(0, 200)}`)
            .setURL(url)
            .setImage('attachment://screenshot.png')
            .setFooter({ text: 'Screenshot captured' });
          await interaction.editReply({ embeds: [embed], files: [attachment] });
          return;
        }
      } catch (err) {
        logger.debug({ err }, 'screenshot API failed, trying next');
        continue;
      }
    }

    // All APIs failed
    await interaction.editReply(`Could not capture screenshot of **${url.slice(0, 100)}**. The site may block screenshots (e.g. X/Twitter, login-required pages).`);
  },
};

export default screenshot;
