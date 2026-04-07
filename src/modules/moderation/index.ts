import type { BotModule } from '../../types';
import clear from './commands/clear';
import botrole from './commands/botrole';
import help from './commands/help';
import timeout from './commands/timeout';
import ban from './commands/ban';
import slowmode from './commands/slowmode';
import warn from './commands/warn';
import lockdown from './commands/lockdown';
import mute from './commands/mute';
import kick from './commands/kick';
import unban from './commands/unban';
import nuke from './commands/nuke';
import role from './commands/role';
import modlogs from './commands/modlogs';
import caseCmd from './commands/case';
import antinuke from './commands/antinuke';
import { registerAntiNuke } from '../../services/antinuke';
import type { Client } from 'discord.js';

const moderationModule: BotModule = {
  name: 'moderation',
  enabled: true,
  guildOnly: true,
  commands: [clear, botrole, help, timeout, ban, slowmode, warn, lockdown, mute, kick, unban, nuke, role, modlogs, caseCmd, antinuke],

  async onLoad(client: Client): Promise<void> {
    registerAntiNuke(client);
  },
};

export default moderationModule;
