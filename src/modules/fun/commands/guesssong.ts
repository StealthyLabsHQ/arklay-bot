import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getQueues } from '../../../services/musicQueue';

function hideTitle(title: string): string {
  return title.replace(/\S+/g, (word) => {
    if (word.length <= 1) return word;
    return word[0] + '_'.repeat(word.length - 1);
  });
}

function extractSignificantWords(title: string): string[] {
  // Strip common separators to try to isolate the song name
  const parts = title.split(/\s*[-–—|]\s*/);
  // Use the last part (usually the song name) if there are multiple parts
  const songPart = parts.length > 1 ? parts.slice(1).join(' ') : title;
  return songPart
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function fuzzyMatch(guess: string, title: string): boolean {
  const words = extractSignificantWords(title);
  if (words.length === 0) return false;

  const guessLower = guess.toLowerCase();
  let matched = 0;
  for (const word of words) {
    if (guessLower.includes(word)) matched++;
  }

  return matched / words.length >= 0.6;
}

const guesssong: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('guesssong')
    .setDescription('Guess a song from the current music queue!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const queue = getQueues().get(guildId);
    if (!queue || !queue.currentTrack || queue.tracks.length < 1) {
      await interaction.reply({
        content: 'There must be an active queue with at least 1 upcoming track to play this game.',
        ephemeral: true,
      });
      return;
    }

    // Pick a random track from the queue (not currentTrack)
    const randomIndex = Math.floor(Math.random() * queue.tracks.length);
    const track = queue.tracks[randomIndex]!;
    const hidden = hideTitle(track.title);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Guess the Song!')
      .setDescription(`**${hidden}**\n\nYou have 30 seconds to guess!`);
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    await interaction.reply({ embeds: [embed] });

    const channel = interaction.channel as TextChannel;
    const collector = channel.createMessageCollector({
      filter: (msg) => !msg.author.bot,
      time: 30_000,
    });

    let won = false;

    collector.on('collect', (msg) => {
      if (fuzzyMatch(msg.content, track.title)) {
        won = true;
        const victoryEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('Correct!')
          .setDescription(`${msg.author} guessed it!\n\nThe song was: **${track.title}**`);
        if (track.thumbnail) victoryEmbed.setThumbnail(track.thumbnail);
        channel.send({ embeds: [victoryEmbed] }).catch(() => undefined);
        collector.stop('guessed');
      }
    });

    collector.on('end', (_collected, reason) => {
      if (reason !== 'guessed' && !won) {
        const revealEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Time\'s up!')
          .setDescription(`Nobody guessed it.\n\nThe song was: **${track.title}**`);
        if (track.thumbnail) revealEmbed.setThumbnail(track.thumbnail);
        channel.send({ embeds: [revealEmbed] }).catch(() => undefined);
      }
    });
  },
};

export default guesssong;
