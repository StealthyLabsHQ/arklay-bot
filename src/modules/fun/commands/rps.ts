import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const CHOICES = ['Rock', 'Paper', 'Scissors'] as const;
type Choice = (typeof CHOICES)[number];

const EMOJIS: Record<Choice, string> = {
  Rock: '🪨',
  Paper: '📄',
  Scissors: '✂️',
};

function getResult(player: Choice, bot: Choice): 'win' | 'lose' | 'tie' {
  if (player === bot) return 'tie';
  if (
    (player === 'Rock' && bot === 'Scissors') ||
    (player === 'Paper' && bot === 'Rock') ||
    (player === 'Scissors' && bot === 'Paper')
  ) {
    return 'win';
  }
  return 'lose';
}

const RESULT_CONFIG = {
  win: { color: 0x57f287, title: 'You win! 🎉', desc: 'Nice one!' },
  lose: { color: 0xed4245, title: 'You lose! 😢', desc: 'Better luck next time!' },
  tie: { color: 0xfee75c, title: "It's a tie! 🤝", desc: 'Great minds think alike!' },
} as const;

const rps: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock paper scissors against the bot')
    .addStringOption((opt) =>
      opt
        .setName('choice')
        .setDescription('Your move')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Rock', value: 'Rock' },
          { name: '📄 Paper', value: 'Paper' },
          { name: '✂️ Scissors', value: 'Scissors' },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const playerChoice = interaction.options.getString('choice', true) as Choice;
    const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)]!;
    const result = getResult(playerChoice, botChoice);
    const cfg = RESULT_CONFIG[result];

    const embed = new EmbedBuilder()
      .setColor(cfg.color)
      .setTitle(cfg.title)
      .setDescription(cfg.desc)
      .addFields(
        { name: 'You', value: `${EMOJIS[playerChoice]} ${playerChoice}`, inline: true },
        { name: 'vs', value: '⚔️', inline: true },
        { name: 'Bot', value: `${EMOJIS[botChoice]} ${botChoice}`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default rps;
