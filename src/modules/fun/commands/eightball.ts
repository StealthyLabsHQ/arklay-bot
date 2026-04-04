import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const RESPONSES = [
  // Positive
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.',
  // Neutral
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
  'Cannot predict now.', 'Concentrate and ask again.',
  // Negative
  'Don\'t count on it.', 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

const eightball: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Your yes/no question').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const answer   = RESPONSES[Math.floor(Math.random() * RESPONSES.length)]!;

    const embed = new EmbedBuilder()
      .setColor(0x1f0040)
      .setTitle('Magic 8-Ball')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Answer',   value: `**${answer}**` },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default eightball;
