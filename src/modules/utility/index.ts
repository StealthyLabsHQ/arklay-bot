import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import type { BotModule } from '../../types';
import ping from './commands/ping';
import tags from './commands/tags';
import giveaway, { setGiveawayClient, restoreGiveaways } from './commands/giveaway';
import userinfo from './commands/userinfo';
import serverinfo from './commands/serverinfo';
import remindme from './commands/remindme';
import poll from './commands/poll';
import avatar from './commands/avatar';
import banner from './commands/banner';
import roleinfo from './commands/roleinfo';
import channelinfo from './commands/channelinfo';
import membercount from './commands/membercount';
import invite from './commands/invite';
import math from './commands/math';
import define from './commands/define';
import crypto from './commands/crypto';
import weather from './commands/weather';
import afk from './commands/afk';
import emoji from './commands/emoji';
import steal from './commands/steal';
import botinfo from './commands/botinfo';
import twitch from './commands/twitch';
import audit from './commands/audit';
import snipe from './commands/snipe';
import color from './commands/color';
import timestamp from './commands/timestamp';
import screenshot from './commands/screenshot';
import qrcode from './commands/qrcode';
import stealSticker from './contextMenus/stealSticker';
import { deletedMessages } from './commands/snipe';
import { editedMessages } from './commands/editsnipe';

const utilityModule: BotModule = {
  name: 'utility',
  enabled: true,
  commands: [ping, userinfo, serverinfo, remindme, poll, avatar, banner, roleinfo, channelinfo, membercount, invite, math, define, crypto, weather, afk, emoji, steal, botinfo, snipe, color, timestamp, screenshot, qrcode, tags, giveaway, twitch, audit],
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
