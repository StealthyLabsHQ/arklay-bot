import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import db from '../../../services/db';
import { logger } from '../../../services/logger';

interface PlayRow { user_id: string; plays: number }

const PER_PAGE = 5;
const MEDALS = ['🥇', '🥈', '🥉'];

const leaderboard: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top listeners on this server')
    .addStringOption((opt) =>
      opt
        .setName('period')
        .setDescription('Time period (default: month)')
        .setRequired(false)
        .addChoices(
          { name: 'This week',  value: 'week' },
          { name: 'This month', value: 'month' },
          { name: 'All time',   value: 'alltime' },
        )
    ) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const period  = interaction.options.getString('period') ?? 'month';
      const guildId = interaction.guildId!;

      let rows: PlayRow[];
      if (period === 'alltime') {
        rows = db.prepare(
          'SELECT user_id, COUNT(*) as plays FROM music_plays WHERE guild_id = ? GROUP BY user_id ORDER BY plays DESC LIMIT 10'
        ).all(guildId) as PlayRow[];
      } else {
        const seconds = period === 'week' ? 7 * 86400 : 30 * 86400;
        rows = db.prepare(
          'SELECT user_id, COUNT(*) as plays FROM music_plays WHERE guild_id = ? AND played_at > (unixepoch() - ?) GROUP BY user_id ORDER BY plays DESC LIMIT 10'
        ).all(guildId, seconds) as PlayRow[];
      }

      if (rows.length === 0) {
        await interaction.editReply({ content: 'No listening data for this period yet.' });
        return;
      }

      // Resolve display names
      const userNames = new Map<string, string>();
      await Promise.all(
        rows.map(async (r) => {
          try {
            const member = await interaction.guild!.members.fetch(r.user_id);
            userNames.set(r.user_id, member.displayName);
          } catch {
            userNames.set(r.user_id, `<@${r.user_id}>`);
          }
        })
      );

      const periodLabel = period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time';
      const totalPages  = Math.ceil(rows.length / PER_PAGE);
      let page = 0;

      const buildEmbed = (p: number): EmbedBuilder => {
        const slice = rows.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const lines = slice.map((r, i) => {
          const rank     = p * PER_PAGE + i + 1;
          const medal    = MEDALS[rank - 1] ?? `**#${rank}**`;
          const name     = userNames.get(r.user_id) ?? `<@${r.user_id}>`;
          const estMins  = Math.round(r.plays * 3.5);
          const estTime  = estMins >= 60 ? `${Math.floor(estMins / 60)}h ${estMins % 60}m` : `${estMins}m`;
          return `${medal} **${name}** — ${r.plays} track${r.plays !== 1 ? 's' : ''} · ~${estTime}`;
        });
        return new EmbedBuilder()
          .setColor(0x7289da)
          .setTitle('🎵 Top Listeners')
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Updated live · ${periodLabel}${totalPages > 1 ? ` · Page ${p + 1}/${totalPages}` : ''}` });
      };

      const buildRow = (p: number): ActionRowBuilder<ButtonBuilder> =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
        );

      const reply = await interaction.editReply({
        embeds: [buildEmbed(page)],
        components: totalPages > 1 ? [buildRow(page)] : [],
      });

      if (totalPages <= 1) return;

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
      });

      collector.on('collect', async (btn) => {
        if (btn.user.id !== interaction.user.id) {
          await btn.reply({ content: 'Only the command invoker can navigate.', ephemeral: true });
          return;
        }
        if (btn.customId === 'lb_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'lb_next') page = Math.min(totalPages - 1, page + 1);
        await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      });

      collector.on('end', async () => {
        await interaction.editReply({
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
              new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
            ),
          ],
        }).catch(() => undefined);
      });
    } catch (err) {
      logger.warn({ err }, '/leaderboard failed');
      const msg = { content: 'Could not load leaderboard. Try again later.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => undefined);
      else await interaction.reply(msg).catch(() => undefined);
    }
  },
};

export default leaderboard;
