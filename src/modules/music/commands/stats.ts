import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import db from '../../../services/db';

const stmtTopTracks = db.prepare(
  'SELECT title, COUNT(*) as plays FROM music_plays WHERE guild_id = ? GROUP BY title ORDER BY plays DESC LIMIT 10'
);
const stmtTopUsers = db.prepare(
  'SELECT user_id, COUNT(*) as plays FROM music_plays WHERE guild_id = ? GROUP BY user_id ORDER BY plays DESC LIMIT 5'
);
const stmtTotal = db.prepare(
  'SELECT COUNT(*) as total FROM music_plays WHERE guild_id = ?'
);

export function recordPlay(guildId: string, userId: string, title: string, artist?: string | null): void {
  db.prepare('INSERT INTO music_plays (guild_id, user_id, title, artist) VALUES (?, ?, ?, ?)').run(guildId, userId, title, artist ?? null);
}

const stats: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show music statistics for this server') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;

    const total = (stmtTotal.get(guildId) as { total: number }).total;
    if (total === 0) {
      await interaction.reply({ content: 'No music has been played yet on this server.', ephemeral: true });
      return;
    }

    const topTracks = stmtTopTracks.all(guildId) as Array<{ title: string; plays: number }>;
    const topUsers = stmtTopUsers.all(guildId) as Array<{ user_id: string; plays: number }>;

    const trackList = topTracks.map((t, i) => `**${i + 1}.** ${t.title.slice(0, 50)} — ${t.plays} plays`).join('\n');
    const userList = topUsers.map((u, i) => `**${i + 1}.** <@${u.user_id}> — ${u.plays} plays`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xe91e63)
      .setTitle('Music Stats')
      .addFields(
        { name: 'Total Plays', value: `${total}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Top Tracks', value: trackList || 'None yet' },
        { name: 'Top Listeners', value: userList || 'None yet' },
      )
      .setFooter({ text: 'Server music statistics' });

    await interaction.reply({ embeds: [embed] });
  },
};

export default stats;
