import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const CLIENT_ID     = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!res.ok) return null;

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

const twitch: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('twitch')
    .setDescription('Check if a Twitch streamer is currently live')
    .addStringOption((opt) =>
      opt.setName('username').setDescription('Twitch username').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      await interaction.reply({ content: 'Twitch integration is not configured.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const username = interaction.options.getString('username', true).toLowerCase();
    const token    = await getToken();

    if (!token) {
      await interaction.editReply('Failed to authenticate with Twitch API.');
      return;
    }

    const headers = { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` };

    const [streamRes, userRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?user_login=${username}`, { headers }),
      fetch(`https://api.twitch.tv/helix/users?login=${username}`, { headers }),
    ]);

    if (!streamRes.ok || !userRes.ok) {
      await interaction.editReply('Failed to fetch Twitch data. Check the username and try again.');
      return;
    }

    const streamData = await streamRes.json() as { data: Array<{
      title: string; game_name: string; viewer_count: number; started_at: string; thumbnail_url: string;
    }> };
    const userData = await userRes.json() as { data: Array<{
      display_name: string; profile_image_url: string; description: string;
    }> };

    const user   = userData.data[0];
    const stream = streamData.data[0];

    if (!user) {
      await interaction.editReply(`User \`${username}\` not found on Twitch.`);
      return;
    }

    if (!stream) {
      const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setAuthor({ name: user.display_name, iconURL: user.profile_image_url })
        .setTitle(`${user.display_name} is offline`)
        .setDescription(user.description || 'No description.')
        .setFooter({ text: 'Twitch' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const thumbnail = stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248');
    const startedAt = Math.floor(new Date(stream.started_at).getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x9146ff)
      .setAuthor({ name: user.display_name, iconURL: user.profile_image_url })
      .setTitle(stream.title || 'No title')
      .addFields(
        { name: 'Game',     value: stream.game_name || 'Unknown', inline: true },
        { name: 'Viewers',  value: stream.viewer_count.toLocaleString(), inline: true },
        { name: 'Live since', value: `<t:${startedAt}:R>`, inline: true },
      )
      .setImage(thumbnail)
      .setFooter({ text: 'Twitch • LIVE' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default twitch;
