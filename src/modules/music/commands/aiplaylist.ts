import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask } from '../../../services/ai/router';
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
    const guildId = interaction.guildId!;

    // Ask AI for 5 song recommendations
    let aiResult;
    try {
      aiResult = await ask(
        guildId,
        interaction.user.id,
        `Generate exactly 5 song recommendations for: ${userPrompt}. Format each line as: Artist - Song Title. Output ONLY the 5 lines, no numbering, no explanation.`
      );
    } catch (err) {
      logger.error({ err }, '/ai-playlist: AI request failed');
      await interaction.editReply('Could not generate playlist suggestions. Try again later.');
      return;
    }

    // Parse the 5 lines
    const lines = aiResult.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 5);

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

    // Resolve each song
    const requestedBy = `<@${interaction.user.id}>`;
    const added: string[] = [];

    for (const line of lines) {
      try {
        const result = await resolve(line, requestedBy);
        if (result.tracks.length > 0) {
          queue.tracks.push(result.tracks[0]!);
          added.push(result.tracks[0]!.title);
        }
      } catch (err) {
        logger.warn({ err }, '/ai-playlist: failed to resolve "%s"', line);
      }
    }

    if (added.length === 0) {
      await interaction.editReply('Could not resolve any of the suggested songs.');
      return;
    }

    // Start playing if not already
    if (!queue.isPlaying) {
      queue.playNext().catch((err) => logger.error({ err }, '/ai-playlist: playNext failed'));
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('AI Playlist')
      .setDescription(
        `**Prompt:** ${userPrompt}\n\n` +
        added.map((t, i) => `**${i + 1}.** ${t}`).join('\n')
      )
      .setFooter({ text: `${added.length} track(s) added | Powered by ${aiResult.provider}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default aiplaylist;
