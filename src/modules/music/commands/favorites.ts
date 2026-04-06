import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import db from '../../../services/db';
import { getQueues } from '../../../services/musicQueue';
import { GuildQueue, type Track } from '../structures/GuildQueue';
import { resolve } from '../utils/resolver';
import { logger } from '../../../services/logger';

const stmtAdd = db.prepare('INSERT INTO user_favorites (user_id, title, url, duration, source) VALUES (?, ?, ?, ?, ?)');
const stmtList = db.prepare('SELECT id, title, url, duration, source FROM user_favorites WHERE user_id = ? ORDER BY saved_at DESC');
const stmtRemove = db.prepare('DELETE FROM user_favorites WHERE id = ? AND user_id = ?');
const stmtClear = db.prepare('DELETE FROM user_favorites WHERE user_id = ?');
const stmtCount = db.prepare('SELECT COUNT(*) as cnt FROM user_favorites WHERE user_id = ?');

const ITEMS_PER_PAGE = 10;
const MAX_FAVORITES = 100;

const favorites: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('favorites')
    .setDescription('Manage your favorite tracks')
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Save the current track to favorites')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show your saved favorites')
    )
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Play a favorite track or all favorites')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Favorite ID to play (omit for all)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a track from favorites')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Favorite ID to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('Clear all favorites')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'add': {
        const guildId = interaction.guildId!;
        const queue = getQueues().get(guildId);
        if (!queue?.currentTrack) {
          await interaction.reply({ content: 'No track is currently playing.', ephemeral: true });
          return;
        }
        const count = (stmtCount.get(userId) as { cnt: number }).cnt;
        if (count >= MAX_FAVORITES) {
          await interaction.reply({ content: `You have reached the maximum of ${MAX_FAVORITES} favorites.`, ephemeral: true });
          return;
        }
        const t = queue.currentTrack;
        stmtAdd.run(userId, t.title, t.url, t.durationStr, t.source);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('Added to Favorites')
            .setDescription(`**${t.title}** (${t.durationStr})`)
          ],
          ephemeral: true,
        });
        return;
      }

      case 'list': {
        const rows = stmtList.all(userId) as Array<{ id: number; title: string; url: string; duration: string; source: string }>;
        if (rows.length === 0) {
          await interaction.reply({ content: 'No favorites yet. Use `/favorites add` while a track plays.', ephemeral: true });
          return;
        }
        const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
        let page = 0;

        function buildPage(p: number): EmbedBuilder {
          const start = p * ITEMS_PER_PAGE;
          const items = rows.slice(start, start + ITEMS_PER_PAGE);
          const list = items.map((r, i) => `**${start + i + 1}.** [${r.title}](${r.url}) \`${r.duration}\` — ID: ${r.id}`).join('\n');
          return new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`Your Favorites (${rows.length})`)
            .setDescription(list)
            .setFooter({ text: `Page ${p + 1}/${totalPages} • /favorites play <id> to queue` });
        }

        if (totalPages <= 1) {
          await interaction.reply({ embeds: [buildPage(0)], ephemeral: true });
          return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('fav_prev').setEmoji('\u25C0').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('fav_page').setLabel(`1/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('fav_next').setEmoji('\u25B6').setStyle(ButtonStyle.Primary).setDisabled(totalPages <= 1),
        );
        const reply = await interaction.reply({ embeds: [buildPage(0)], components: [row], ephemeral: true });
        const msg = await reply.fetch();

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });
        collector.on('collect', async (btn) => {
          if (btn.customId === 'fav_prev') page = Math.max(0, page - 1);
          else if (btn.customId === 'fav_next') page = Math.min(totalPages - 1, page + 1);
          const r = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('fav_prev').setEmoji('\u25C0').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId('fav_page').setLabel(`${page + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fav_next').setEmoji('\u25B6').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
          );
          await btn.update({ embeds: [buildPage(page)], components: [r] });
        });
        collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => undefined); });
        return;
      }

      case 'play': {
        const member = interaction.member as GuildMember;
        const vc = member.voice.channel;
        if (!vc) {
          await interaction.reply({ content: 'You must be in a voice channel.', ephemeral: true });
          return;
        }

        const targetId = interaction.options.getInteger('id');
        const rows = targetId
          ? (db.prepare('SELECT title, url FROM user_favorites WHERE id = ? AND user_id = ?').all(targetId, userId) as Array<{ title: string; url: string }>)
          : (stmtList.all(userId) as Array<{ title: string; url: string }>);

        if (rows.length === 0) {
          await interaction.reply({ content: targetId ? `Favorite #${targetId} not found.` : 'No favorites to play.', ephemeral: true });
          return;
        }

        await interaction.deferReply();
        const guildId = interaction.guildId!;
        let queue = getQueues().get(guildId);
        if (!queue) {
          queue = new GuildQueue(guildId, interaction.channel as TextChannel);
          getQueues().set(guildId, queue);
        }
        await queue.connect(vc, member);

        const requestedBy = `<@${userId}>`;
        let added = 0;
        for (const row of rows) {
          try {
            const result = await resolve(row.url || row.title, requestedBy);
            if (result.tracks.length > 0) {
              queue.tracks.push(result.tracks[0]!);
              added++;
            }
          } catch { /* skip failed */ }
          if (!queue.isPlaying && added === 1) {
            queue.playNext().catch((err) => logger.error({ err }, 'favorites play error'));
          }
        }

        await interaction.editReply(`Added **${added}** favorite(s) to the queue.`);
        return;
      }

      case 'remove': {
        const id = interaction.options.getInteger('id', true);
        const result = stmtRemove.run(id, userId);
        await interaction.reply({
          content: result.changes > 0 ? `Removed favorite #${id}.` : `Favorite #${id} not found.`,
          ephemeral: true,
        });
        return;
      }

      case 'clear': {
        const result = stmtClear.run(userId);
        await interaction.reply({ content: `Cleared ${result.changes} favorites.`, ephemeral: true });
        return;
      }
    }
  },
};

export default favorites;
