import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import eightball from './eightball';
import choose from './choose';
import coinflip from './coinflip';
import dice from './dice';
import gif from './gif';
import guesssong from './guesssong';
import how from './how';
import leaderboard from './leaderboard';
import meme from './meme';
import quote from './quote';
import rate from './rate';
import rps from './rps';
import trivia from './trivia';

const fun: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Fun & entertainment commands')
    .addSubcommand((sub) =>
      sub.setName('eightball').setDescription('Ask the magic 8-ball a question')
        .addStringOption((opt) => opt.setName('question').setDescription('Your question').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('choose').setDescription('Randomly pick from options')
        .addStringOption((opt) => opt.setName('options').setDescription('Options separated by comma or "or"').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('coinflip').setDescription('Flip a coin')
    )
    .addSubcommand((sub) =>
      sub.setName('dice').setDescription('Roll dice')
        .addIntegerOption((opt) => opt.setName('count').setDescription('Number of dice (default 1)').setRequired(false).setMinValue(1).setMaxValue(10))
        .addIntegerOption((opt) => opt.setName('sides').setDescription('Sides per die (default 6)').setRequired(false).setMinValue(2).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('gif').setDescription('Search for a GIF')
        .addStringOption((opt) => opt.setName('query').setDescription('What to search for').setRequired(true).setMaxLength(200))
        .addStringOption((opt) =>
          opt.setName('mode').setDescription('Search mode').setRequired(false)
            .addChoices(
              { name: 'Search (top result)', value: 'search' },
              { name: 'Exact match',         value: 'exact' },
              { name: 'Random',              value: 'random' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('guesssong').setDescription('Guess a song playing in the queue')
    )
    .addSubcommand((sub) =>
      sub.setName('how').setDescription('How <trait> is <thing>?')
        .addStringOption((opt) => opt.setName('trait').setDescription('Trait to measure').setRequired(true))
        .addStringOption((opt) => opt.setName('thing').setDescription('Thing to measure').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('leaderboard').setDescription('Top listeners on this server')
        .addStringOption((opt) =>
          opt.setName('period').setDescription('Time period').setRequired(false)
            .addChoices(
              { name: 'This week', value: 'week' },
              { name: 'This month', value: 'month' },
              { name: 'All time',  value: 'alltime' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('meme').setDescription('Get a random meme')
        .addStringOption((opt) => opt.setName('search').setDescription('Search for a specific meme topic').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('quote').setDescription('Get a random inspirational quote')
    )
    .addSubcommand((sub) =>
      sub.setName('rate').setDescription('Rate something 0-10')
        .addStringOption((opt) => opt.setName('thing').setDescription('What to rate').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('rps').setDescription('Play rock paper scissors')
        .addStringOption((opt) =>
          opt.setName('choice').setDescription('Your choice').setRequired(true)
            .addChoices(
              { name: 'Rock',     value: 'Rock' },
              { name: 'Paper',    value: 'Paper' },
              { name: 'Scissors', value: 'Scissors' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('trivia').setDescription('Answer a random trivia question')
        .addStringOption((opt) =>
          opt.setName('category').setDescription('Trivia category').setRequired(false)
            .addChoices(
              { name: 'General Knowledge', value: '9' },
              { name: 'Science',           value: '17' },
              { name: 'History',           value: '23' },
              { name: 'Geography',         value: '22' },
              { name: 'Video Games',       value: '15' },
              { name: 'Movies',            value: '11' },
              { name: 'Music',             value: '12' },
              { name: 'Sports',            value: '21' },
              { name: 'AI Generated',      value: 'ai' },
            )
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const handlers: Record<string, CommandDef> = {
      eightball, choose, coinflip, dice, gif, guesssong, how, leaderboard, meme, quote, rate, rps, trivia,
    };
    await handlers[sub]?.execute(interaction);
  },
};

export default fun;
