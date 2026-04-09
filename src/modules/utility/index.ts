import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import type { BotModule } from '../../types';
import info from './commands/info';
import tools from './commands/tools';
import stealSticker from './contextMenus/stealSticker';
import { setGiveawayClient, restoreGiveaways } from './commands/giveaway';
import { deletedMessages } from './commands/snipe';
import { editedMessages } from './commands/editsnipe';

const utilityModule: BotModule = {
  name: 'utility',
  enabled: true,
  commands: [info, tools],
  contextMenus: [stealSticker],

  async onLoad(client: Client): Promise<void> {
    setGiveawayClient(client);
    await restoreGiveaways();

    // Snipe: track deleted messages
    client.on(Events.MessageDelete, (message) => {
      if (!message.author || message.author.bot) return;
      deletedMessages.set(message.channelId, {
        content: message.content ?? '',
        authorTag: message.author.tag,
        authorAvatar: message.author.displayAvatarURL(),
        attachments: message.attachments.map((a) => a.url),
        timestamp: Date.now(),
      });
    });

    // Editsnipe: track edited messages
    client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
      if (!oldMessage.author || oldMessage.author.bot) return;
      if (oldMessage.content === newMessage.content) return;
      editedMessages.set(oldMessage.channelId, {
        oldContent: oldMessage.content ?? '',
        newContent: newMessage.content ?? '',
        authorTag: oldMessage.author.tag,
        authorAvatar: oldMessage.author.displayAvatarURL(),
        messageUrl: newMessage.url ?? '',
        timestamp: Date.now(),
      });
    });
  },
};

export default utilityModule;
