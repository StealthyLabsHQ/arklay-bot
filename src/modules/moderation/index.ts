import type { Client } from 'discord.js';
import type { BotModule } from '../../types';
import mod from './commands/mod';
import { registerAntiNuke } from '../../services/antinuke';

const moderationModule: BotModule = {
  name: 'moderation',
  enabled: true,
  guildOnly: true,
  commands: [mod],

  async onLoad(client: Client): Promise<void> {
    registerAntiNuke(client);
  },
};

export default moderationModule;
