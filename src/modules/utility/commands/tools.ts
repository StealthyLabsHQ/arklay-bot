import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import afk from './afk';
import audit from './audit';
import crypto from './crypto';
import define from './define';
import editsnipe from './editsnipe';
import math from './math';
import poll from './poll';
import qrcode from './qrcode';
import remindme from './remindme';
import screenshot from './screenshot';
import snipe from './snipe';
import steal from './steal';
import timestamp from './timestamp';
import twitch from './twitch';
import weather from './weather';
import giveaway from './giveaway';
import tags from './tags';

const tools: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('tools')
    .setDescription('Utility tools and utilities')
    // ── Simple subcommands ────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub.setName('afk').setDescription('Set your AFK status')
        .addStringOption((opt) => opt.setName('reason').setDescription('AFK reason').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('audit').setDescription('View recent audit log entries (admin only)')
        .addIntegerOption((opt) => opt.setName('limit').setDescription('Number of entries (1-15)').setRequired(false).setMinValue(1).setMaxValue(15))
    )
    .addSubcommand((sub) =>
      sub.setName('crypto').setDescription('Get current cryptocurrency prices')
        .addStringOption((opt) =>
          opt.setName('coin').setDescription('Cryptocurrency (default: Bitcoin)').setRequired(false)
            .addChoices(
              { name: 'BTC (bitcoin)',   value: 'bitcoin' },
              { name: 'ETH (ethereum)',  value: 'ethereum' },
              { name: 'SOL (solana)',    value: 'solana' },
              { name: 'ADA (cardano)',   value: 'cardano' },
              { name: 'DOGE (dogecoin)', value: 'dogecoin' },
              { name: 'XRP (ripple)',    value: 'ripple' },
              { name: 'DOT (polkadot)', value: 'polkadot' },
              { name: 'LTC (litecoin)', value: 'litecoin' },
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('define').setDescription('Look up the definition of a word')
        .addStringOption((opt) => opt.setName('word').setDescription('Word to define').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('editsnipe').setDescription('Show the previous version of the last edited message')
    )
    .addSubcommand((sub) =>
      sub.setName('math').setDescription('Evaluate a math expression')
        .addStringOption((opt) => opt.setName('expression').setDescription('Math expression').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('poll').setDescription('Create a poll with buttons')
        .addStringOption((opt) => opt.setName('question').setDescription('Poll question').setRequired(true))
        .addStringOption((opt) => opt.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption((opt) => opt.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption((opt) => opt.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption((opt) => opt.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption((opt) => opt.setName('option5').setDescription('Option 5').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('qrcode').setDescription('Generate a QR code')
        .addStringOption((opt) => opt.setName('text').setDescription('Text or URL to encode').setRequired(true))
        .addIntegerOption((opt) => opt.setName('size').setDescription('Image size in px (100-1000)').setRequired(false).setMinValue(100).setMaxValue(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('remindme').setDescription('Set a reminder (max 24h)')
        .addStringOption((opt) => opt.setName('duration').setDescription('Duration (e.g. 30m, 2h)').setRequired(true))
        .addStringOption((opt) => opt.setName('message').setDescription('Reminder message').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('screenshot').setDescription('Take a screenshot of a website')
        .addStringOption((opt) => opt.setName('url').setDescription('URL to screenshot').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('snipe').setDescription('Show the last deleted message in this channel')
    )
    .addSubcommand((sub) =>
      sub.setName('steal').setDescription('Add an external emoji to this server')
        .addStringOption((opt) => opt.setName('emoji').setDescription('Emoji to steal').setRequired(true))
        .addStringOption((opt) => opt.setName('name').setDescription('Custom name for the emoji').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('timestamp').setDescription('Convert a date to all Discord timestamp formats')
        .addStringOption((opt) => opt.setName('date').setDescription('Date string (e.g. "2025-01-01 12:00")').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('twitch').setDescription('Check if a Twitch streamer is currently live')
        .addStringOption((opt) => opt.setName('username').setDescription('Twitch username').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('weather').setDescription('Get current weather for a city')
        .addStringOption((opt) => opt.setName('city').setDescription('City name').setRequired(true))
    )
    // ── Subcommand groups ─────────────────────────────────────────────────────
    .addSubcommandGroup((group) =>
      group.setName('giveaway').setDescription('Manage giveaways')
        .addSubcommand((sub) =>
          sub.setName('start').setDescription('Start a giveaway (admin only)')
            .addStringOption((opt) => opt.setName('prize').setDescription('What to give away').setRequired(true).setMaxLength(200))
            .addStringOption((opt) => opt.setName('duration').setDescription('Duration: 10m, 2h, 1d').setRequired(true))
            .addIntegerOption((opt) => opt.setName('winners').setDescription('Number of winners (default 1)').setRequired(false).setMinValue(1).setMaxValue(20))
            .addStringOption((opt) => opt.setName('description').setDescription('Optional description').setRequired(false).setMaxLength(500))
            .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to post in (default: current)').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName('end').setDescription('End a giveaway early (admin only)')
            .addStringOption((opt) => opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName('reroll').setDescription('Reroll a giveaway winner (admin only)')
            .addStringOption((opt) => opt.setName('message_id').setDescription('Message ID of the ended giveaway').setRequired(true))
        )
    )
    .addSubcommandGroup((group) =>
      group.setName('tags').setDescription('Custom server tags / text snippets')
        .addSubcommand((sub) =>
          sub.setName('create').setDescription('Create a new tag (admin only)')
            .addStringOption((opt) => opt.setName('name').setDescription('Tag name (a-z, 0-9, hyphens, max 32)').setRequired(true).setMaxLength(32))
            .addStringOption((opt) => opt.setName('content').setDescription('Tag content (max 2000 chars)').setRequired(true).setMaxLength(2000))
        )
        .addSubcommand((sub) =>
          sub.setName('show').setDescription('Show a tag')
            .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('List all tags on this server')
        )
        .addSubcommand((sub) =>
          sub.setName('delete').setDescription('Delete a tag (admin only)')
            .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((sub) =>
          sub.setName('edit').setDescription('Edit a tag content (admin only)')
            .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
            .addStringOption((opt) => opt.setName('content').setDescription('New content (max 2000 chars)').setRequired(true).setMaxLength(2000))
        )
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    // Group dispatch
    if (group === 'giveaway') return giveaway.execute(interaction);
    if (group === 'tags')     return tags.execute(interaction);

    // Root subcommand dispatch
    const handlers: Record<string, CommandDef> = {
      afk, audit, crypto, define, editsnipe, math, poll, qrcode, remindme,
      screenshot, snipe, steal, timestamp, twitch, weather,
    };
    await handlers[sub]?.execute(interaction);
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'tags' && tags.autocomplete) {
      await tags.autocomplete(interaction);
    }
  },
};

export default tools;
