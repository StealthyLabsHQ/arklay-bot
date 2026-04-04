import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  OAuth2Scopes,
  PermissionFlagsBits,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client, GuildMember, StringSelectMenuInteraction, TextChannel } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import { getLanguage } from '../../../services/guildConfig';
import { config } from '../../../services/config';

interface CmdEntry { name: string; desc: Record<string, string>; usage?: string; admin?: boolean; providers?: string }

interface Category {
  label: Record<string, string>;
  description: Record<string, string>;
  emoji: string;
  commands: CmdEntry[];
}

// ── Model list for AI commands ───────────────────────────────────────────────

const ALL_MODELS = [
  'Claude Sonnet 4.6 (Anthropic)',
  'Claude Opus 4.6 (Anthropic)',
  'Claude Haiku 4.5 (Anthropic)',
  'Gemini 3 Flash (Google)',
  'Gemini 3.1 Pro (Google)',
  'Gemini 3.1 Flash Lite (Google)',
].join('\n');

function resolveProviders(providers?: string): string | null {
  if (!providers) return null;
  if (providers === 'all') return ALL_MODELS;
  return providers;
}

// ── i18n helper ──────────────────────────────────────────────────────────────

function t(map: Record<string, string>, lang: string): string {
  return map[lang] ?? map['en']!;
}

// ── Categories with i18n (en + fr) ──────────────────────────────────────────

const CATEGORIES: Record<string, Category> = {
  music: {
    label:       { en: 'Music', fr: 'Musique' },
    description: { en: 'Play music from YouTube, Spotify & SoundCloud', fr: 'Jouer de la musique depuis YouTube, Spotify & SoundCloud' },
    emoji: '\uD83C\uDFB5',
    commands: [
      { name: 'play',        desc: { en: 'Add a track or playlist to the queue', fr: 'Ajouter un titre ou playlist' }, usage: '/play <query>' },
      { name: 'pause',       desc: { en: 'Pause the current track', fr: 'Mettre en pause' } },
      { name: 'resume',      desc: { en: 'Resume playback', fr: 'Reprendre la lecture' } },
      { name: 'skip',        desc: { en: 'Skip to the next track', fr: 'Passer au titre suivant' } },
      { name: 'skipto',      desc: { en: 'Skip to a specific position in the queue', fr: 'Aller a une position dans la file' }, usage: '/skipto <position>' },
      { name: 'stop',        desc: { en: 'Stop playback and clear the queue', fr: 'Stopper et vider la file' } },
      { name: 'queue',       desc: { en: 'Display the current queue', fr: 'Afficher la file d\'attente' } },
      { name: 'nowplaying',  desc: { en: 'Show the currently playing track', fr: 'Titre en cours de lecture' } },
      { name: 'replay',      desc: { en: 'Restart the current track', fr: 'Relancer le titre en cours' } },
      { name: 'loop',        desc: { en: 'Set loop mode (off / track / queue)', fr: 'Mode boucle (off / titre / file)' }, usage: '/loop <mode>' },
      { name: 'volume',      desc: { en: 'Adjust playback volume (0-100)', fr: 'Ajuster le volume (0-100)' }, usage: '/volume <0-100>' },
      { name: 'shuffle',     desc: { en: 'Shuffle the queue', fr: 'M\u00e9langer la file' } },
      { name: 'remove',      desc: { en: 'Remove a track by position', fr: 'Retirer un titre par position' }, usage: '/remove <position>' },
      { name: 'save',        desc: { en: 'Save the current track to your DMs', fr: 'Sauvegarder le titre en DM' } },
      { name: 'lyrics',      desc: { en: 'Show lyrics for the current track', fr: 'Afficher les paroles' }, usage: '/lyrics [search]' },
      { name: 'seek',        desc: { en: 'Jump to a position in the track', fr: 'Aller a un moment du titre' }, usage: '/seek <timestamp>' },
      { name: 'filter',      desc: { en: 'Apply an audio filter', fr: 'Appliquer un filtre audio' }, usage: '/filter <type>' },
      { name: 'ai-playlist', desc: { en: 'Generate a playlist with AI', fr: 'G\u00e9n\u00e9rer une playlist avec l\'IA' }, usage: '/ai-playlist <prompt>' },
      { name: 'previous',   desc: { en: 'Play the previous track again', fr: 'Rejouer le titre pr\u00e9c\u00e9dent' } },
      { name: 'move',       desc: { en: 'Move a track to a different position', fr: 'D\u00e9placer un titre dans la file' }, usage: '/move <from> <to>' },
      { name: 'autoplay',   desc: { en: 'Toggle autoplay when queue ends', fr: 'Activer/d\u00e9sactiver la lecture auto' } },
    ],
  },
  ai: {
    label:       { en: 'AI', fr: 'Intelligence Artificielle' },
    description: { en: 'Chat with Claude & Gemini, generate images', fr: 'Discuter avec Claude & Gemini, g\u00e9n\u00e9rer des images' },
    emoji: '\uD83E\uDD16',
    commands: [
      { name: 'ask',         desc: { en: 'Ask a question to Claude or Gemini', fr: 'Poser une question a Claude ou Gemini' }, usage: '/ask <question> [provider]', providers: 'all' },
      { name: 'summarize',   desc: { en: 'Summarize recent channel messages', fr: 'R\u00e9sumer les messages r\u00e9cents' }, usage: '/summarize [messages] [provider]', providers: 'all' },
      { name: 'nanobanana',  desc: { en: 'Generate an image or configure settings', fr: 'G\u00e9n\u00e9rer une image ou configurer' }, usage: '/nanobanana <prompt> [image]', providers: 'Gemini (Nano Banana 2)' },
      { name: 'setmodel',    desc: { en: 'Choose your personal AI model', fr: 'Choisir votre mod\u00e8le IA' }, usage: '/setmodel [model]', providers: 'all' },
      { name: 'translate',   desc: { en: 'Translate text using AI', fr: 'Traduire du texte avec l\'IA' }, usage: '/translate <language> <text>', providers: 'all' },
      { name: 'roast',       desc: { en: 'Get a lighthearted AI roast', fr: 'Se faire chambrer par l\'IA' }, usage: '/roast <user>', providers: 'all' },
      { name: 'vision',      desc: { en: 'Analyze an image with AI', fr: 'Analyser une image avec l\'IA' }, usage: '/vision <image> [prompt]', providers: 'all' },
      { name: 'catchup',     desc: { en: 'AI-powered catch-up of recent activity', fr: 'R\u00e9sum\u00e9 IA de l\'activit\u00e9 r\u00e9cente' }, providers: 'all' },
      { name: 'tldr',        desc: { en: 'Summarize a webpage with AI', fr: 'R\u00e9sumer une page web avec l\'IA' }, usage: '/tldr <url>', providers: 'all' },
    ],
  },
  moderation: {
    label:       { en: 'Moderation', fr: 'Mod\u00e9ration' },
    description: { en: 'Ban, kick, warn, timeout & more', fr: 'Bannir, expulser, avertir, exclure & plus' },
    emoji: '\uD83D\uDEE1\uFE0F',
    commands: [
      { name: 'clear',       desc: { en: 'Delete messages (1-100)', fr: 'Supprimer des messages (1-100)' }, usage: '/clear <amount>', admin: true },
      { name: 'timeout',     desc: { en: 'Timeout a user', fr: 'Exclure temporairement' }, usage: '/timeout <user> <duration> [reason]', admin: true },
      { name: 'ban',         desc: { en: 'Ban a user', fr: 'Bannir un utilisateur' }, usage: '/ban <user> [reason] [delete_history]', admin: true },
      { name: 'unban',       desc: { en: 'Unban a user', fr: 'D\u00e9bannir un utilisateur' }, usage: '/unban <userid> [reason]', admin: true },
      { name: 'kick',        desc: { en: 'Kick a user', fr: 'Expulser un utilisateur' }, usage: '/kick <user> [reason]', admin: true },
      { name: 'warn',        desc: { en: 'Warn a user (add/list/clear)', fr: 'Avertir un utilisateur' }, usage: '/warn <add|list|clear> <user> [reason]', admin: true },
      { name: 'lockdown',    desc: { en: 'Toggle channel lockdown', fr: 'Verrouiller/d\u00e9verrouiller le salon' }, usage: '/lockdown [channel]', admin: true },
      { name: 'slowmode',    desc: { en: 'Set channel slowmode', fr: 'D\u00e9finir le mode lent' }, usage: '/slowmode <seconds>', admin: true },
      { name: 'mute',        desc: { en: 'Server mute/unmute in voice', fr: 'Mute/unmute vocal' }, usage: '/mute <user>', admin: true },
      { name: 'nuke',        desc: { en: 'Delete and recreate a channel', fr: 'Supprimer et recr\u00e9er un salon' }, admin: true },
      { name: 'botrole',     desc: { en: 'Manage bot admin roles', fr: 'G\u00e9rer les r\u00f4les admin du bot' }, usage: '/botrole <add|remove|list> [role]', admin: true },
      { name: 'role',        desc: { en: 'Toggle a role on a user', fr: 'Ajouter/retirer un r\u00f4le' }, usage: '/role <user> <role>', admin: true },
    ],
  },
  utility: {
    label:       { en: 'Utility', fr: 'Utilitaires' },
    description: { en: 'Server info, tools & emoji management', fr: 'Infos serveur, outils & gestion d\'emojis' },
    emoji: '\uD83D\uDEE0\uFE0F',
    commands: [
      { name: 'help',        desc: { en: 'Show this help menu', fr: 'Afficher ce menu d\'aide' }, usage: '/help [command]' },
      { name: 'ping',        desc: { en: 'Show bot latency', fr: 'Afficher la latence du bot' } },
      { name: 'userinfo',    desc: { en: 'Display user information', fr: 'Infos sur un utilisateur' }, usage: '/userinfo [user]' },
      { name: 'serverinfo',  desc: { en: 'Display server stats', fr: 'Statistiques du serveur' } },
      { name: 'avatar',      desc: { en: 'Display a user\'s avatar', fr: 'Afficher l\'avatar d\'un utilisateur' }, usage: '/avatar [user]' },
      { name: 'banner',      desc: { en: 'Display a user\'s banner', fr: 'Afficher la banni\u00e8re d\'un utilisateur' }, usage: '/banner [user]' },
      { name: 'roleinfo',    desc: { en: 'Info about a role', fr: 'Infos sur un r\u00f4le' }, usage: '/roleinfo <role>' },
      { name: 'channelinfo', desc: { en: 'Info about a channel', fr: 'Infos sur un salon' }, usage: '/channelinfo [channel]' },
      { name: 'membercount', desc: { en: 'Server member count', fr: 'Nombre de membres' } },
      { name: 'invite',      desc: { en: 'Get the bot invite link', fr: 'Lien d\'invitation du bot' } },
      { name: 'math',        desc: { en: 'Evaluate a math expression', fr: '\u00c9valuer une expression math' }, usage: '/math <expression>' },
      { name: 'define',      desc: { en: 'Look up a word definition', fr: 'Chercher la d\u00e9finition d\'un mot' }, usage: '/define <word>' },
      { name: 'crypto',      desc: { en: 'Cryptocurrency prices', fr: 'Prix des cryptomonnaies' }, usage: '/crypto [coin]' },
      { name: 'weather',     desc: { en: 'Current weather for a city', fr: 'M\u00e9t\u00e9o actuelle d\'une ville' }, usage: '/weather <city>' },
      { name: 'afk',         desc: { en: 'Set/remove AFK status', fr: 'D\u00e9finir/retirer le statut AFK' }, usage: '/afk [reason]' },
      { name: 'remindme',    desc: { en: 'Set a reminder (max 24h)', fr: 'D\u00e9finir un rappel (max 24h)' }, usage: '/remindme <duration> <message>' },
      { name: 'poll',        desc: { en: 'Create a poll with buttons', fr: 'Cr\u00e9er un sondage avec boutons' }, usage: '/poll <question> <options>' },
      { name: 'emoji',       desc: { en: 'Get info and full-size image of an emoji', fr: 'Infos et image agrandie d\'un emoji' }, usage: '/emoji <emoji>' },
      { name: 'steal',       desc: { en: 'Add an external emoji to this server', fr: 'Voler un emoji externe' }, usage: '/steal <emoji> [name]' },
      { name: 'botinfo',    desc: { en: 'Learn about this bot and who built it', fr: '\u00c0 propos du bot et son cr\u00e9ateur' } },
      { name: 'snipe',      desc: { en: 'Show the last deleted message', fr: 'Voir le dernier message supprim\u00e9' } },
      { name: 'editsnipe',  desc: { en: 'Show the last edited message', fr: 'Voir le dernier message \u00e9dit\u00e9' } },
      { name: 'color',      desc: { en: 'Preview a color from hex code', fr: 'Pr\u00e9visualiser une couleur hex' }, usage: '/color <hex>' },
      { name: 'timestamp',  desc: { en: 'Convert a date to Discord timestamps', fr: 'Convertir une date en timestamps Discord' }, usage: '/timestamp <date>' },
    ],
  },
  fun: {
    label:       { en: 'Fun', fr: 'Divertissement' },
    description: { en: 'Games, memes & entertainment', fr: 'Jeux, m\u00e8mes & divertissement' },
    emoji: '\uD83C\uDFB2',
    commands: [
      { name: '8ball',       desc: { en: 'Ask the magic 8-ball', fr: 'Demander a la boule magique' }, usage: '/8ball <question>' },
      { name: 'choose',      desc: { en: 'Random pick from options', fr: 'Choix al\u00e9atoire parmi des options' }, usage: '/choose <options>' },
      { name: 'coinflip',    desc: { en: 'Flip a coin', fr: 'Lancer une pi\u00e8ce' } },
      { name: 'dice',        desc: { en: 'Roll dice', fr: 'Lancer des d\u00e9s' }, usage: '/dice [count] [sides]' },
      { name: 'trivia',      desc: { en: 'Answer a trivia question', fr: 'R\u00e9pondre a une question de culture g\u00e9n\u00e9rale' }, usage: '/trivia [category]' },
      { name: 'meme',        desc: { en: 'Get a random meme', fr: 'Obtenir un m\u00e8me al\u00e9atoire' } },
      { name: 'guesssong',   desc: { en: 'Guess the song from a hint', fr: 'Deviner le titre d\'une chanson' } },
      { name: 'rps',         desc: { en: 'Rock paper scissors vs the bot', fr: 'Pierre feuille ciseaux vs le bot' }, usage: '/rps <choice>' },
      { name: 'rate',        desc: { en: 'Rate something 0-10', fr: 'Noter quelque chose de 0 \u00e0 10' }, usage: '/rate <thing>' },
      { name: 'how',         desc: { en: 'How cool/smart/sus is something?', fr: '\u00c0 quel point quelque chose est cool/smart/sus ?' }, usage: '/how <trait> <thing>' },
    ],
  },
  configuration: {
    label:       { en: 'Configuration', fr: 'Configuration' },
    description: { en: 'Auto-role, welcome, logs, temp VCs & language', fr: 'Auto-r\u00f4le, bienvenue, logs, VCs temp & langue' },
    emoji: '\u2699\uFE0F',
    commands: [
      { name: 'config autorole',  desc: { en: 'Auto-assign role to new members', fr: 'R\u00f4le auto pour les nouveaux membres' }, usage: '/config autorole [role]', admin: true },
      { name: 'config welcome',   desc: { en: 'Set welcome message', fr: 'Message de bienvenue' }, usage: '/config welcome [channel] [message]', admin: true },
      { name: 'config logs',      desc: { en: 'Set mod log channel', fr: 'Salon de logs de mod\u00e9ration' }, usage: '/config logs [channel]', admin: true },
      { name: 'config tempvc',    desc: { en: 'Set temp voice channel hub', fr: 'Hub de salons vocaux temporaires' }, usage: '/config tempvc [channel]', admin: true },
      { name: 'config automod',   desc: { en: 'Toggle AI auto-moderation', fr: 'Activer/d\u00e9sactiver l\'automod IA' }, usage: '/config automod <on|off>', admin: true },
      { name: 'config language',  desc: { en: 'Set the bot language', fr: 'D\u00e9finir la langue du bot' }, usage: '/config language <lang>', admin: true },
      { name: 'config show',      desc: { en: 'Show current config', fr: 'Afficher la config actuelle' }, admin: true },
    ],
  },
};

// ── Static i18n strings ─────────────────────────────────────────────────────

const STRINGS: Record<string, Record<string, string>> = {
  title:         { en: '%bot% Help Center', fr: 'Centre d\'aide %bot%' },
  welcome:       { en: 'Welcome to the interactive help menu! Select a command category from the dropdown below to view available commands.', fr: 'Bienvenue dans le menu d\'aide interactif ! S\u00e9lectionnez une cat\u00e9gorie ci-dessous pour voir les commandes disponibles.' },
  links:         { en: '[Invite Me](%invite%) \u2022 [Documentation](%docs%)', fr: '[M\'inviter](%invite%) \u2022 [Documentation](%docs%)' },
  selectLabel:   { en: 'Browse commands...', fr: 'Parcourir les commandes...' },
  overviewLabel: { en: 'Overview', fr: 'Vue d\'ensemble' },
  overviewDesc:  { en: 'Show all categories', fr: 'Voir toutes les cat\u00e9gories' },
  footer:        { en: '%bot% \u2022 StealthyLabs', fr: '%bot% \u2022 StealthyLabs' },
  catFooter:     { en: '%n commands available', fr: '%n commandes disponibles' },
  selectCat:     { en: 'Select a category below', fr: 'S\u00e9lectionnez une cat\u00e9gorie ci-dessous' },
};

const DOCS_URL = 'https://stealthylabs.eu/docs/arklay-bot';

// ── Command lookup ──────────────────────────────────────────────────────────

function findCommand(name: string): { cmd: CmdEntry; category: Category; catId: string } | null {
  const normalized = name.replace(/^\//, '').toLowerCase().trim();
  for (const [catId, cat] of Object.entries(CATEGORIES)) {
    const cmd = cat.commands.find((c) => c.name.toLowerCase() === normalized);
    if (cmd) return { cmd, category: cat, catId };
  }
  return null;
}

function buildCommandEmbed(name: string, client: Client, lang: string): EmbedBuilder | null {
  const found = findCommand(name);
  if (!found) return null;

  const { cmd, category, catId } = found;
  const botAvatar = client.user?.displayAvatarURL({ size: 256 }) ?? null;
  const prefix = config.BOT_PREFIX;

  const colorMap: Record<string, number> = {
    music: 0x1db954, ai: 0x4285f4, moderation: 0xed4245,
    utility: 0x5865f2, fun: 0xfee75c, configuration: 0x99aab5,
  };

  const slashUsage = cmd.usage ?? `/${cmd.name}`;
  const botName = config.BOT_NAME;
  // Commands with spaces (subcommands like "config autorole") don't support prefix
  const hasPrefix = !cmd.name.includes(' ');

  let usageValue = `\`${slashUsage}\``;
  if (hasPrefix) {
    const args = cmd.usage ? cmd.usage.replace(/^\/\S+\s*/, '') : '';
    usageValue += `\n\`${prefix}${cmd.name}${args ? ' ' + args : ''}\``;
    usageValue += `\n\`${botName} ${cmd.name}${args ? ' ' + args : ''}\``;
  }

  const embed = new EmbedBuilder()
    .setColor(colorMap[catId] ?? 0x5865f2)
    .setTitle(`${category.emoji} ${cmd.name}`)
    .addFields(
      { name: t({ en: 'Description', fr: 'Description' }, lang), value: t(cmd.desc, lang) },
      { name: t({ en: 'Usage', fr: 'Utilisation' }, lang), value: usageValue },
      { name: t({ en: 'Prefix Support', fr: 'Support pr\u00e9fixe' }, lang), value: hasPrefix ? '\u2705' : '\u274C' },
    );

  const providerList = resolveProviders(cmd.providers);
  if (providerList) {
    embed.addFields({ name: t({ en: 'Supported Models', fr: 'Mod\u00e8les support\u00e9s' }, lang), value: providerList });
  }

  if (cmd.admin) {
    embed.addFields({ name: t({ en: 'Permission', fr: 'Permission' }, lang), value: t({ en: 'Admin only', fr: 'Admin uniquement' }, lang) });
  }

  if (botAvatar) embed.setThumbnail(botAvatar);
  embed.setTimestamp();

  return embed;
}

// ── Builders ────────────────────────────────────────────────────────────────

function getInviteUrl(client: Client): string {
  return client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageGuildExpressions,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.MoveMembers,
    ],
  });
}

function buildOverview(isAdmin: boolean, client: Client, lang: string): EmbedBuilder {
  const inviteUrl = getInviteUrl(client);
  const botAvatar = client.user?.displayAvatarURL({ size: 256 }) ?? null;
  const botName = client.user?.username ?? 'Bot';

  const links = t(STRINGS['links']!, lang)
    .replace('%invite%', inviteUrl)
    .replace('%docs%', DOCS_URL);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: t(STRINGS['title']!, lang).replace('%bot%', botName),
      iconURL: botAvatar ?? undefined,
    })
    .setDescription(`${t(STRINGS['welcome']!, lang)}\n\n${links}`)
    .setThumbnail(botAvatar)
    .setFooter({ text: `${t(STRINGS['selectCat']!, lang)} \u2022 ${t(STRINGS['footer']!, lang).replace('%bot%', botName)}` })
    .setTimestamp();

  let totalCmds = 0;
  for (const [, cat] of Object.entries(CATEGORIES)) {
    const cmds = cat.commands.filter((c) => !c.admin || isAdmin);
    totalCmds += cmds.length;
    embed.addFields({
      name: `${cat.emoji} ${t(cat.label, lang)} (${cmds.length})`,
      value: t(cat.description, lang),
    });
  }

  embed.setTitle(`${totalCmds} commands`);

  return embed;
}

function buildCategoryEmbed(categoryId: string, isAdmin: boolean, client: Client, lang: string): EmbedBuilder {
  const cat = CATEGORIES[categoryId]!;
  const cmds = cat.commands.filter((c) => !c.admin || isAdmin);
  const botAvatar = client.user?.displayAvatarURL({ size: 256 }) ?? null;

  const colorMap: Record<string, number> = {
    music: 0x1db954, ai: 0x4285f4, moderation: 0xed4245,
    utility: 0x5865f2, fun: 0xfee75c, configuration: 0x99aab5,
  };

  const list = cmds.map((c) => {
    // In category view, show short provider tag (not full model list)
    let providerTag = '';
    if (c.providers) {
      const short = c.providers === 'all' ? 'Claude, Gemini' : c.providers;
      providerTag = ` \u2022 *${short}*`;
    }
    return `\`/${c.name}\` \u2014 ${t(c.desc, lang)}${providerTag}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(colorMap[categoryId] ?? 0x5865f2)
    .setTitle(`${cat.emoji} ${t(cat.label, lang)}`)
    .setDescription(list)
    .setThumbnail(botAvatar)
    .setFooter({ text: t(STRINGS['catFooter']!, lang).replace('%n', String(cmds.length)) })
    .setTimestamp();
}

function buildSelectMenu(lang: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('help_category')
    .setPlaceholder(t(STRINGS['selectLabel']!, lang))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t(STRINGS['overviewLabel']!, lang))
        .setDescription(t(STRINGS['overviewDesc']!, lang))
        .setValue('overview')
        .setEmoji('\uD83D\uDCCB'),
      ...Object.entries(CATEGORIES).map(([id, cat]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(t(cat.label, lang))
          .setDescription(t(cat.description, lang))
          .setValue(id)
          .setEmoji(cat.emoji)
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function buildLinkButtons(client: Client): ActionRowBuilder<ButtonBuilder> {
  const inviteUrl = getInviteUrl(client);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Invite')
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl)
      .setEmoji('\uD83D\uDD17'),
    new ButtonBuilder()
      .setLabel('Documentation')
      .setStyle(ButtonStyle.Link)
      .setURL(DOCS_URL)
      .setEmoji('\uD83D\uDCD6'),
  );
}

// ── Shared help sender (used by slash command + text prefix) ────────────────

export async function sendHelp(
  client: Client,
  channel: TextChannel,
  guildId: string,
  member: GuildMember | null,
  commandName?: string,
): Promise<void> {
  const isAdmin = member ? isBotAdmin(member) : false;
  const lang = getLanguage(guildId);

  // Single command detail via prefix (e.g. .help play)
  if (commandName) {
    const embed = buildCommandEmbed(commandName, client, lang);
    if (embed) {
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(`Command \`${commandName}\` not found.`);
    }
    return;
  }

  const msg = await channel.send({
    embeds: [buildOverview(isAdmin, client, lang)],
    components: [buildSelectMenu(lang), buildLinkButtons(client)],
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300_000,
  });

  collector.on('collect', async (i: StringSelectMenuInteraction) => {
    const selected = i.values[0]!;
    const embed = selected === 'overview'
      ? buildOverview(isAdmin, client, lang)
      : buildCategoryEmbed(selected, isAdmin, client, lang);

    await i.update({ embeds: [embed], components: [buildSelectMenu(lang), buildLinkButtons(client)] });
  });

  collector.on('end', async () => {
    await msg.edit({ components: [] }).catch(() => undefined);
  });
}

// ── Slash command ───────────────────────────────────────────────────────────

const help: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption((opt) =>
      opt.setName('command').setDescription('Command name to get details (e.g. play)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member  = interaction.member as GuildMember;
    const isAdmin = isBotAdmin(member);
    const lang    = getLanguage(interaction.guildId!);

    // Single command detail
    const cmdName = interaction.options.getString('command');
    if (cmdName) {
      const embed = buildCommandEmbed(cmdName, interaction.client, lang);
      if (!embed) {
        await interaction.reply({ content: `Command \`${cmdName}\` not found.`, ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const reply = await interaction.reply({
      embeds: [buildOverview(isAdmin, interaction.client, lang)],
      components: [buildSelectMenu(lang), buildLinkButtons(interaction.client)],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      const selected = i.values[0]!;
      const embed = selected === 'overview'
        ? buildOverview(isAdmin, interaction.client, lang)
        : buildCategoryEmbed(selected, isAdmin, interaction.client, lang);

      await i.update({ embeds: [embed], components: [buildSelectMenu(lang), buildLinkButtons(interaction.client)] });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => undefined);
    });
  },
};

export default help;
