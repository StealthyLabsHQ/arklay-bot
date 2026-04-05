import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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
        .setDescription('Number of tracks to generate (default 5, max 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Ask AI for song recommendations
    let aiResult;
    try {
      aiResult = await ask(
        guildId,
        interaction.user.id,
        `Generate exactly ${count} song recommendations for: ${userPrompt}. Format each line as: Artist - Song Title. Output ONLY the ${count} lines, no numbering, no explanation.`
      );
    } catch (err) {
      logger.error({ err }, '/ai-playlist: AI request failed');
      await interaction.editReply('Could not generate playlist suggestions. Try again later.');
      return;
    }

    // Parse the lines
    const lines = aiResult.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, count);

    if (lines.length === 0) {
      await interaction.editReply('AI returned no song suggestions. Try a different prompt.');
      return;
    }

    // Get or create queue
    let queue = getQueues().get(guildId);
    if (!queue) {
      queue = new GuildQueue(guildId, interaction.channel as TextChannel);
      getQueues().set(guildId, queue);
    }

    queue.connect(voiceChannel, member);

    // Resolve songs in parallel batches for speed
    const requestedBy = `<@${interaction.user.id}>`;
    const added: string[] = [];
    const BATCH = 5;
    let startedPlaying = false;

    for (let i = 0; i < lines.length; i += BATCH) {
      const batch = lines.slice(i, i + BATCH);
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
      aiResult.provider,
      aiResult.model,
      aiResult.provider === 'claude' && isVertexMode()
    );
    const left = remaining(interaction.user.id, aiResult.model);
    const quota = left !== null ? ` \u2022 ${left} req left` : '';

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('AI Playlist')
      .setDescription(
        `**Prompt:** ${userPrompt}, ${count} tracks max\n\n` +
        added.map((t, i) => `**${i + 1}.** ${t}`).join('\n')
      )
      .setFooter({ text: `${added.length} track(s) added \u2022 ${modelName} (${source})${quota}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default aiplaylist;
