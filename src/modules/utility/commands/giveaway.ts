import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import {
  createGiveaway, setMessageId, getGiveawayByMessageId, getActiveGiveaways,
  endGiveaway, parseDuration,
} from '../../../services/giveaway';
import { logger } from '../../../services/logger';

// Shared client reference set during module load
let _client: Client | null = null;
export function setGiveawayClient(client: Client): void { _client = client; }

async function resolveGiveaway(
  messageId: string, guildId: string
): Promise<{ row: ReturnType<typeof getGiveawayByMessageId>; msg: import('discord.js').Message | null }> {
  const row = getGiveawayByMessageId(messageId);
  if (!row || row.guild_id !== guildId) return { row: undefined, msg: null };
  try {
    const channel = await _client!.channels.fetch(row.channel_id) as TextChannel | null;
    const msg     = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
    return { row, msg };
  } catch {
    return { row, msg: null };
  }
}

async function drawWinners(
  messageId: string,
  winnerCount: number,
  rowId: number
): Promise<void> {
  if (!_client) return;
  try {
    const row = getGiveawayByMessageId(messageId);
    if (!row || row.ended) return;

    const channel = await _client.channels.fetch(row.channel_id) as TextChannel | null;
    if (!channel) { endGiveaway(rowId, []); return; }

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) { endGiveaway(rowId, []); return; }

    const reaction = msg.reactions.cache.get('🎉');
    const users    = reaction ? await reaction.users.fetch() : new Map();
    const eligible = [...users.values()].filter((u) => !u.bot && u.id !== _client!.user?.id);

    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const winners  = shuffled.slice(0, winnerCount).map((u) => u.id);

    endGiveaway(rowId, winners);

    const endedEmbed = new EmbedBuilder()
      .setColor(0x99aab5)
      .setTitle(`🎉 ${row.prize}`)
      .setDescription(
        winners.length > 0
          ? `**Winner${winners.length > 1 ? 's' : ''}:** ${winners.map((id) => `<@${id}>`).join(', ')}`
          : 'No valid entries — no winner drawn.'
      )
      .addFields({ name: 'Hosted by', value: `<@${row.host_id}>`, inline: true })
      .setFooter({ text: 'ENDED' })
      .setTimestamp();

    await msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => undefined);

    if (winners.length > 0) {
      await channel.send(
        `🎊 Congrats ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${row.prize}**!`
      ).catch(() => undefined);

      for (const id of winners) {
        const user = await _client.users.fetch(id).catch(() => null);
        if (!user) continue;
        await user.send(`You won **${row.prize}** in a giveaway on **${channel.guild.name}**!`).catch(() => undefined);
      }
    }
  } catch (err) {
    logger.warn({ err }, 'giveaway drawWinners failed');
  }
}

const MAX_TIMEOUT = 2_147_483_647; // max 32-bit signed int (~24.8 days)

export async function scheduleGiveaway(
  messageId: string, rowId: number, winnerCount: number, endsAt: Date
): Promise<void> {
  const delay = endsAt.getTime() - Date.now();
  if (delay <= 0) {
    await drawWinners(messageId, winnerCount, rowId);
    return;
  }
  if (delay > MAX_TIMEOUT) {
    setTimeout(() => scheduleGiveaway(messageId, rowId, winnerCount, endsAt), MAX_TIMEOUT);
    return;
  }
  setTimeout(() => drawWinners(messageId, winnerCount, rowId), delay);
}

export async function restoreGiveaways(): Promise<void> {
  const active = getActiveGiveaways();
  for (const row of active) {
    if (!row.message_id) continue;
    const endsAt = new Date(row.ends_at);
    await scheduleGiveaway(row.message_id, row.id, row.winner_count, endsAt);
  }
  if (active.length > 0) logger.info('giveaway: restored %d active giveaways', active.length);
}

const giveaway: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a giveaway')
        .addStringOption((opt) => opt.setName('prize').setDescription('What to give away').setRequired(true).setMaxLength(200))
        .addStringOption((opt) => opt.setName('duration').setDescription('Duration: 10m, 2h, 1d').setRequired(true))
        .addIntegerOption((opt) => opt.setName('winners').setDescription('Number of winners (default 1)').setRequired(false).setMinValue(1).setMaxValue(20))
        .addStringOption((opt) => opt.setName('description').setDescription('Optional description for the giveaway').setRequired(false).setMaxLength(500))
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to post in (default: current)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early (admin only)')
        .addStringOption((opt) => opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll a giveaway winner (admin only)')
        .addStringOption((opt) => opt.setName('message_id').setDescription('Message ID of the ended giveaway').setRequired(true))
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const sub     = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;
      const member  = interaction.guild!.members.cache.get(interaction.user.id)
                   ?? await interaction.guild!.members.fetch(interaction.user.id);

      // ── start ─────────────────────────────────────────────────────────────
      if (sub === 'start') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to start a giveaway.', ephemeral: true });
          return;
        }

        const prize       = interaction.options.getString('prize', true);
        const durationStr = interaction.options.getString('duration', true);
        const description = interaction.options.getString('description');
        const winnerCount = interaction.options.getInteger('winners') ?? 1;
        const channelOpt  = interaction.options.getChannel('channel');

        const ms = parseDuration(durationStr);
        if (!ms) {
          await interaction.reply({ content: 'Invalid duration. Use format like `10m`, `2h`, `1d`.', ephemeral: true });
          return;
        }

        const targetChannel = (channelOpt as TextChannel | null) ?? interaction.channel as TextChannel;
        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.reply({ content: 'Could not find a valid text channel.', ephemeral: true });
          return;
        }

        const endsAt = new Date(Date.now() + ms);

        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle(`🎉 ${prize}`)
          .setDescription(`React with 🎉 to enter!\n${description ? `\n${description}\n` : ''}\n**Winners:** ${winnerCount}\n**Hosted by:** <@${interaction.user.id}>`)
          .setFooter({ text: `Ends at` })
          .setTimestamp(endsAt);

        await interaction.reply({ content: `Giveaway started in ${targetChannel}!`, ephemeral: true });

        const giveawayMsg = await targetChannel.send({ embeds: [embed] });
        await giveawayMsg.react('🎉').catch(() => undefined);

        const rowId = createGiveaway(guildId, targetChannel.id, prize, interaction.user.id, winnerCount, endsAt);
        setMessageId(rowId, giveawayMsg.id);

        await scheduleGiveaway(giveawayMsg.id, rowId, winnerCount, endsAt);
        return;
      }

      // ── end ───────────────────────────────────────────────────────────────
      if (sub === 'end') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to end a giveaway.', ephemeral: true });
          return;
        }
        const messageId         = interaction.options.getString('message_id', true);
        const { row }           = await resolveGiveaway(messageId, guildId);
        if (!row) {
          await interaction.reply({ content: 'No active giveaway found with that message ID.', ephemeral: true });
          return;
        }
        if (row.ended) {
          await interaction.reply({ content: 'That giveaway has already ended.', ephemeral: true });
          return;
        }
        await interaction.reply({ content: 'Ending giveaway now…', ephemeral: true });
        await drawWinners(messageId, row.winner_count, row.id);
        return;
      }

      // ── reroll ────────────────────────────────────────────────────────────
      if (sub === 'reroll') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to reroll a giveaway.', ephemeral: true });
          return;
        }
        const messageId = interaction.options.getString('message_id', true);
        const row       = getGiveawayByMessageId(messageId);
        if (!row || row.guild_id !== guildId) {
          await interaction.reply({ content: 'No giveaway found with that message ID.', ephemeral: true });
          return;
        }
        if (!row.ended) {
          await interaction.reply({ content: 'That giveaway has not ended yet. Use `/giveaway end` first.', ephemeral: true });
          return;
        }
        await interaction.reply({ content: 'Rerolling…', ephemeral: true });

        const channel = await _client!.channels.fetch(row.channel_id).catch(() => null) as TextChannel | null;
        const msg     = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (!msg) { await interaction.followUp({ content: 'Could not find the original giveaway message.', ephemeral: true }); return; }

        const reaction = msg.reactions.cache.get('🎉');
        const users    = reaction ? await reaction.users.fetch() : new Map();
        const eligible = [...users.values()].filter((u) => !u.bot && u.id !== _client!.user?.id);
        if (eligible.length === 0) {
          await interaction.followUp({ content: 'No eligible users to reroll.', ephemeral: true });
          return;
        }
        const winner = eligible[Math.floor(Math.random() * eligible.length)]!;
        await channel!.send(`🎊 New winner: <@${winner.id}>! Congrats on winning **${row.prize}**!`).catch(() => undefined);
      }
    } catch (err) {
      logger.warn({ err }, '/giveaway failed');
      const msg = { content: 'Something went wrong. Try again later.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => undefined);
      else await interaction.reply(msg).catch(() => undefined);
    }
  },
};

export default giveaway;
