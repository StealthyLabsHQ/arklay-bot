import type { BotModule } from '../../types';
import fun from './commands/fun';

const funModule: BotModule = {
  name: 'fun',
  enabled: true,
  commands: [fun],
};

export default funModule;
