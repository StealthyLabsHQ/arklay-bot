import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask } from '../../../services/ai/router';
import { isVertexMode } from '../../../services/ai/anthropic';
import { getAIConfig, getModelDisplayInfo } from '../../../services/aiConfig';
import { remaining } from '../../../services/usageLimit';
import { resolve } from '../utils/resolver';
import { getQueues } from '../../../services/musicQueue';
import { GuildQueue } from '../structures/GuildQueue';
import { logger } from '../../../services/logger';

const TRACKS_PER_PAGE = 10;

function buildPlaylistPage(added: string[], page: number, userPrompt: string, count: number, footerText: string): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(added.length / TRACKS_PER_PAGE));
  const start = page * TRACKS_PER_PAGE;
  const pageItems = added.slice(start, start + TRACKS_PER_PAGE);

  const list = pageItems.map((t, i) => `**${start + i + 1}.** ${t}`).join('\n');

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('AI Playlist')
    .setDescription(`**Prompt:** ${userPrompt}, ${count} tracks max\n\n${list}`)
    .setFooter({ text: `${footerText} | Page ${page + 1}/${totalPages}` });
}

function buildPageButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('aip_first')
      .setEmoji('\u23EE')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('aip_prev')
      .setEmoji('\u25C0')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('aip_page')
      .setLabel(`${page + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('aip_next')
      .setEmoji('\u25B6')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('aip_last')
      .setEmoji('\u23ED')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

const aiplaylist: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('ai-playlist')
    .setDescription('Generate a playlist from an AI prompt')
    .addStringOption((opt) =>
      opt
        .setName('prompt')
        .setDescription('Describe the vibe, e.g. chill lo-fi for studying')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('Number of tracks to generate (default 5, max 200)')
        .setMinValue(1)
        .setMaxValue(200)
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Temporarily disabled — YouTube streaming is broken and SoundCloud has limited catalogue
    await interaction.reply({
      content: 'AI Playlist is temporarily unavailable. YouTube streaming is currently broken globally and SoundCloud has a limited music catalogue. Use `/play <song>` to add tracks manually. This feature will return when YouTube is fixed.',
      ephemeral: true,
    });
    return;
    /*
    // ── DISABLED: Re-enable when YouTube streaming is fixed ──────────────
    await interaction.deferReply();

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply('You must be in a voice channel.');
      return;
    }

    const userPrompt = interaction.options.getString('prompt', true);
    const count = interaction.options.getInteger('count') ?? 5;
    const guildId = interaction.guildId!;

    // For large counts, split into multiple AI requests (max ~50 per request for quality)
    const allLines: string[] = [];
    const AI_BATCH = 50;

    let aiResult;
    for (let i = 0; i < count; i += AI_BATCH) {
      const batchCount = Math.min(AI_BATCH, count - i);
      const alreadyHave = allLines.length > 0
        ? `\nDo NOT repeat any of these songs already suggested:\n${allLines.join('\n')}`
        : '';

      try {
        aiResult = await ask(
          guildId,
          interaction.user.id,
          `You are a music expert. Generate exactly ${batchCount} REAL songs that match this request: "${userPrompt}".${alreadyHave}\nRules:\n- Only suggest songs that ACTUALLY exist and are well-known\n- If a specific artist is mentioned, ALL songs must be BY that artist or their members\n- Include the OFFICIAL song title as it appears on streaming platforms\n- Do NOT invent songs, remix names, or confuse artists\n- Format each line EXACTLY as: Artist - Song Title\n- Output ONLY the ${batchCount} lines, no numbering, no explanation, no commentary`
        );
        const lines = aiResult.text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .slice(0, batchCount);
        allLines.push(...lines);
      } catch (err) {
        logger.error({ err }, '/ai-playlist: AI request failed');
        if (allLines.length === 0) {
          await interaction.editReply('Could not generate playlist suggestions. Try again later.');
          return;
        }
        break; // Use what we have so far
      }
    }

    if (allLines.length === 0) {
      await interaction.editReply('AI returned no song suggestions. Try a different prompt.');
      return;
    }

    // Get or create queue
    let queue = getQueues().get(guildId);
    if (!queue) {
      queue = new GuildQueue(guildId, interaction.channel as TextChannel);
      getQueues().set(guildId, queue);
    }

    await queue.connect(voiceChannel, member);

    // Resolve songs in parallel batches for speed
    const requestedBy = `<@${interaction.user.id}>`;
    const added: string[] = [];
    const BATCH = 5;
    let startedPlaying = false;

    for (let i = 0; i < allLines.length; i += BATCH) {
      const batch = allLines.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((line) => resolve(line, requestedBy))
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.tracks.length > 0) {
          queue.tracks.push(r.value.tracks[0]!);
          added.push(r.value.tracks[0]!.title);
        }
      }

      // Start playing as soon as first batch is resolved
      if (!startedPlaying && added.length > 0 && !queue.isPlaying) {
        startedPlaying = true;
        queue.playNext().catch((err) => logger.error({ err }, '/ai-playlist: playNext failed'));
      }
    }

    if (added.length === 0) {
      await interaction.editReply('Could not resolve any of the suggested songs.');
      return;
    }

    const { name: modelName, source } = getModelDisplayInfo(
      aiResult!.provider,
      aiResult!.model,
      aiResult!.provider === 'claude' && isVertexMode()
    );
    const left = remaining(interaction.user.id, aiResult!.model);
    const quota = left !== null ? ` \u2022 ${left} req left` : '';
    const footerText = `${added.length} track(s) added \u2022 ${modelName} (${source})${quota}`;

    const totalPages = Math.max(1, Math.ceil(added.length / TRACKS_PER_PAGE));

    // Single page — no buttons needed
    if (totalPages <= 1) {
      const embed = buildPlaylistPage(added, 0, userPrompt, count, footerText);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Multi-page with pagination buttons
    let page = 0;
    const embed = buildPlaylistPage(added, page, userPrompt, count, footerText);
    const reply = await interaction.editReply({ embeds: [embed], components: [buildPageButtons(page, totalPages)] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: 'Only the command user can navigate.', ephemeral: true });
        return;
      }

      if (btn.customId === 'aip_first') page = 0;
      else if (btn.customId === 'aip_prev') page = Math.max(0, page - 1);
      else if (btn.customId === 'aip_next') page = Math.min(totalPages - 1, page + 1);
      else if (btn.customId === 'aip_last') page = totalPages - 1;

      await btn.update({
        embeds: [buildPlaylistPage(added, page, userPrompt, count, footerText)],
        components: [buildPageButtons(page, totalPages)],
      });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
    */
  },
};

export default aiplaylist;
