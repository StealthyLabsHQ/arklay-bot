import type { BotModule } from '../../types';
import eightball from './commands/eightball';
import choose from './commands/choose';
import trivia from './commands/trivia';
import meme from './commands/meme';
import coinflip from './commands/coinflip';
import dice from './commands/dice';
import guesssong from './commands/guesssong';
import rps from './commands/rps';
import rate from './commands/rate';
import how from './commands/how';
import gif from './commands/gif';

const funModule: BotModule = {
  name: 'fun',
  enabled: true,
  commands: [eightball, choose, trivia, meme, coinflip, dice, guesssong, rps, rate, how, gif],
};

export default funModule;
