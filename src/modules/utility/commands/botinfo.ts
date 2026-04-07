import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, version as djsVersion } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getLanguage } from '../../../services/guildConfig';

function t(map: Record<string, string>, lang: string): string {
  return map[lang] ?? map['en']!;
}

const botinfo: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Learn about this bot and who built it') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client;
    const lang = getLanguage(interaction.guildId ?? '');
    const botAvatar = client.user?.displayAvatarURL({ size: 512 }) ?? null;
    const botName = client.user?.username ?? 'Bot';

    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const uptimeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);

    const description = t({
      en: `**${botName}** is a modular Discord bot combining music playback, AI-powered commands (Claude & Gemini), image generation, server moderation, and utility tools into a single bot.`,
      fr: `**${botName}** est un bot Discord modulaire combinant lecture musicale, commandes IA (Claude & Gemini), g\u00e9n\u00e9ration d'images, mod\u00e9ration et outils utilitaires.`,
    }, lang);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: botName, iconURL: botAvatar ?? undefined })
      .setTitle(t({ en: `About ${botName}`, fr: `\u00c0 propos de ${botName}` }, lang))
      .setDescription(description)
      .setThumbnail(botAvatar)
      .addFields(
        { name: t({ en: 'Developer', fr: 'D\u00e9veloppeur' }, lang), value: '**StealthyLabs**', inline: true },
        { name: t({ en: 'Language', fr: 'Langage' }, lang), value: 'TypeScript', inline: true },
        { name: t({ en: 'Framework', fr: 'Framework' }, lang), value: `discord.js v${djsVersion}`, inline: true },
        { name: t({ en: 'Servers', fr: 'Serveurs' }, lang), value: `${guilds}`, inline: true },
        { name: t({ en: 'Users', fr: 'Utilisateurs' }, lang), value: `${users.toLocaleString()}`, inline: true },
        { name: t({ en: 'Uptime', fr: 'En ligne depuis' }, lang), value: uptimeStr, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Version', value: 'v2.5.1', inline: true },
        { name: t({ en: 'AI Providers', fr: 'Fournisseurs IA' }, lang), value: 'Anthropic Claude\nGoogle Gemini\nOpenAI ChatGPT', inline: true },
        { name: t({ en: 'Music Sources', fr: 'Sources musicales' }, lang), value: 'YouTube\nSpotify\nSoundCloud', inline: true },
      )
      .setFooter({ text: t({ en: 'Made with \u2764 by StealthyLabs', fr: 'Fait avec \u2764 par StealthyLabs' }, lang) })
      .setTimestamp();

    const links = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Website')
        .setStyle(ButtonStyle.Link)
        .setURL('https://stealthylabs.eu/docs/arklay-bot')
        .setEmoji('\uD83C\uDF10'),
      new ButtonBuilder()
        .setLabel('GitHub')
        .setStyle(ButtonStyle.Link)
        .setURL('https://github.com/StealthyLabsHQ')
        .setEmoji('\uD83D\uDCBB'),
      new ButtonBuilder()
        .setLabel('X (ex-Twitter)')
        .setStyle(ButtonStyle.Link)
        .setURL('https://x.com/StealthyLabsHQ')
        .setEmoji('\uD83D\uDC26'),
      new ButtonBuilder()
        .setLabel('Instagram')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.instagram.com/stealthylabs.hq')
        .setEmoji('\uD83D\uDCF7'),
      new ButtonBuilder()
        .setLabel('TikTok')
        .setStyle(ButtonStyle.Link)
        .setURL('https://tiktok.com/@stealthylabs')
        .setEmoji('\uD83C\uDFB5'),
    );

    await interaction.reply({ embeds: [embed], components: [links] });
  },
};

export default botinfo;
