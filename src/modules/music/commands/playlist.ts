import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import db from '../../../services/db';
import { getQueues } from '../../../services/musicQueue';
import { GuildQueue } from '../structures/GuildQueue';
import { ensureSameVoiceAccess } from './controls';
import { resolve } from '../utils/resolver';
import { logger } from '../../../services/logger';

const MAX_PLAYLISTS = 10;
const MAX_TRACKS = 200;

const playlist: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage personal playlists')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new playlist')
        .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription('Save the current queue as a playlist')
        .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List your playlists')
    )
    .addSubcommand((sub) =>
      sub
        .setName('load')
        .setDescription('Load a playlist into the queue')
        .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Show tracks in a playlist')
        .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a playlist')
        .addStringOption((opt) => opt.setName('name').setDescription('Playlist name').setRequired(true))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'create': {
        const name = interaction.options.getString('name', true).slice(0, 50);
        const count = (db.prepare('SELECT COUNT(*) as cnt FROM user_playlists WHERE user_id = ?').get(userId) as { cnt: number }).cnt;
        if (count >= MAX_PLAYLISTS) {
          await interaction.reply({ content: `Max ${MAX_PLAYLISTS} playlists. Delete one first.`, ephemeral: true });
          return;
        }
        const existing = db.prepare('SELECT id FROM user_playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (existing) {
          await interaction.reply({ content: `Playlist "${name}" already exists.`, ephemeral: true });
          return;
        }
        db.prepare('INSERT INTO user_playlists (user_id, name) VALUES (?, ?)').run(userId, name);
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('Playlist Created').setDescription(`**${name}** — use \`/playlist save\` with a queue to add tracks.`)],
          ephemeral: true,
        });
        return;
      }

      case 'save': {
        const name = interaction.options.getString('name', true).slice(0, 50);
        const queue = getQueues().get(interaction.guildId!);
        const allTracks = queue ? (queue.currentTrack ? [queue.currentTrack, ...queue.tracks] : [...queue.tracks]) : [];
        if (allTracks.length === 0) {
          await interaction.reply({ content: 'Queue is empty — nothing to save.', ephemeral: true });
          return;
        }

        let pl = db.prepare('SELECT id FROM user_playlists WHERE user_id = ? AND name = ?').get(userId, name) as { id: number } | undefined;
        if (!pl) {
          const count = (db.prepare('SELECT COUNT(*) as cnt FROM user_playlists WHERE user_id = ?').get(userId) as { cnt: number }).cnt;
          if (count >= MAX_PLAYLISTS) {
            await interaction.reply({ content: `Max ${MAX_PLAYLISTS} playlists reached.`, ephemeral: true });
            return;
          }
          db.prepare('INSERT INTO user_playlists (user_id, name) VALUES (?, ?)').run(userId, name);
          pl = db.prepare('SELECT id FROM user_playlists WHERE user_id = ? AND name = ?').get(userId, name) as { id: number };
        }

        // Clear existing tracks and replace
        db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(pl.id);
        const insert = db.prepare('INSERT INTO playlist_tracks (playlist_id, title, url, duration, source, position) VALUES (?, ?, ?, ?, ?, ?)');
        const batch = db.transaction((tracks: typeof allTracks) => {
          for (let i = 0; i < Math.min(tracks.length, MAX_TRACKS); i++) {
            const t = tracks[i]!;
            insert.run(pl!.id, t.title, t.url, t.durationStr, t.source, i);
          }
        });
        batch(allTracks);

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('Playlist Saved').setDescription(`**${name}** — ${Math.min(allTracks.length, MAX_TRACKS)} tracks saved.`)],
          ephemeral: true,
        });
        return;
      }

      case 'list': {
        const rows = db.prepare(
          'SELECT p.name, COUNT(t.id) as track_count FROM user_playlists p LEFT JOIN playlist_tracks t ON t.playlist_id = p.id WHERE p.user_id = ? GROUP BY p.id ORDER BY p.created_at DESC'
        ).all(userId) as Array<{ name: string; track_count: number }>;
        if (rows.length === 0) {
          await interaction.reply({ content: 'No playlists. Use `/playlist create` or `/playlist save`.', ephemeral: true });
          return;
        }
        const list = rows.map((r, i) => `**${i + 1}.** ${r.name} — ${r.track_count} tracks`).join('\n');
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('Your Playlists').setDescription(list)],
          ephemeral: true,
        });
        return;
      }

      case 'load': {
        const name = interaction.options.getString('name', true);
        const member = interaction.member as GuildMember;
        const vc = member.voice.channel;
        if (!vc) {
          await interaction.reply({ content: 'You must be in a voice channel.', ephemeral: true });
          return;
        }

        const pl = db.prepare('SELECT id FROM user_playlists WHERE user_id = ? AND name = ?').get(userId, name) as { id: number } | undefined;
        if (!pl) {
          await interaction.reply({ content: `Playlist "${name}" not found.`, ephemeral: true });
          return;
        }

        const tracks = db.prepare('SELECT title, url FROM playlist_tracks WHERE playlist_id = ? ORDER BY position').all(pl.id) as Array<{ title: string; url: string }>;
        if (tracks.length === 0) {
          await interaction.reply({ content: `Playlist "${name}" is empty.`, ephemeral: true });
          return;
        }

        await interaction.deferReply();
        const guildId = interaction.guildId!;
        let queue = getQueues().get(guildId);
        if (!queue) {
          queue = new GuildQueue(guildId, interaction.channel as TextChannel);
          getQueues().set(guildId, queue);
        }
        if (!(await ensureSameVoiceAccess(interaction, queue))) return;
        await queue.connect(vc, member);

        const requestedBy = `<@${userId}>`;
        let added = 0;
        for (const t of tracks) {
          try {
            const result = await resolve(t.url || t.title, requestedBy);
            if (result.tracks.length > 0) {
              queue.enqueue(result.tracks[0]!);
              added++;
            }
          } catch { /* skip */ }
          if (!queue.isPlaying && added === 1) {
            queue.playNext().catch((err) => logger.error({ err }, 'playlist load play error'));
          }
        }

        await interaction.editReply(`Loaded **${name}** — ${added}/${tracks.length} tracks added.`);
        return;
      }

      case 'show': {
        const name = interaction.options.getString('name', true);
        const pl = db.prepare('SELECT id FROM user_playlists WHERE user_id = ? AND name = ?').get(userId, name) as { id: number } | undefined;
        if (!pl) {
          await interaction.reply({ content: `Playlist "${name}" not found.`, ephemeral: true });
          return;
        }
        const tracks = db.prepare('SELECT title, duration FROM playlist_tracks WHERE playlist_id = ? ORDER BY position LIMIT 20').all(pl.id) as Array<{ title: string; duration: string }>;
        const total = (db.prepare('SELECT COUNT(*) as cnt FROM playlist_tracks WHERE playlist_id = ?').get(pl.id) as { cnt: number }).cnt;
        if (tracks.length === 0) {
          await interaction.reply({ content: `Playlist "${name}" is empty.`, ephemeral: true });
          return;
        }
        const list = tracks.map((t, i) => `**${i + 1}.** ${t.title} \`${t.duration}\``).join('\n');
        const extra = total > 20 ? `\n+${total - 20} more...` : '';
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x3498db).setTitle(`Playlist: ${name}`).setDescription(list + extra).setFooter({ text: `${total} tracks total` })],
          ephemeral: true,
        });
        return;
      }

      case 'delete': {
        const name = interaction.options.getString('name', true);
        const result = db.prepare('DELETE FROM user_playlists WHERE user_id = ? AND name = ?').run(userId, name);
        await interaction.reply({
          content: result.changes > 0 ? `Playlist "${name}" deleted.` : `Playlist "${name}" not found.`,
          ephemeral: true,
        });
        return;
      }
    }
  },
};

export default playlist;
