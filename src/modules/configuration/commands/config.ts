import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import {
  getAutorole, setAutorole, removeAutorole,
  getWelcome, setWelcome, removeWelcome,
  getLogChannel, setLogChannel, removeLogChannel,
  getTempVcHub, setTempVcHub, removeTempVcHub,
  isAutomodEnabled, setAutomodEnabled,
  getLanguage, setLanguage, getSupportedLanguages, getLanguageName,
} from '../../../services/guildConfig';

const config: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Server configuration (admin only)')
    .addSubcommand((sub) =>
      sub
        .setName('autorole')
        .setDescription('Set or remove auto-assigned role for new members')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign (omit to disable)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Set or remove welcome message')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Welcome channel (omit to disable)').setRequired(false))
        .addStringOption((opt) => opt.setName('message').setDescription('Welcome message ({user} and {server} placeholders)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('logs')
        .setDescription('Set or remove mod log channel')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Log channel (omit to disable)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('tempvc')
        .setDescription('Set or remove the temporary voice channel hub')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Hub voice channel (omit to disable)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('automod')
        .setDescription('Enable or disable AI auto-moderation')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable auto-moderation').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('language')
        .setDescription('Set the bot language for this server')
        .addStringOption((opt) => {
          opt.setName('lang').setDescription('Language code').setRequired(true);
          for (const [code, name] of Object.entries(getSupportedLanguages())) {
            opt.addChoices({ name: `${name} (${code})`, value: code });
          }
          return opt;
        })
    )
    .addSubcommand((sub) =>
      sub.setName('show').setDescription('Show current configuration')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotAdmin(interaction.member as GuildMember)) {
      await interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
      return;
    }

    const guildId = interaction.guildId!;
    const sub     = interaction.options.getSubcommand();

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      if (!role) {
        removeAutorole(guildId);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Autorole disabled.')], ephemeral: true });
      } else {
        setAutorole(guildId, role.id);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Autorole set to <@&${role.id}>.`)], ephemeral: true });
      }
    } else if (sub === 'welcome') {
      const channel = interaction.options.getChannel('channel');
      const msg     = interaction.options.getString('message') ?? 'Welcome {user} to **{server}**!';
      if (!channel) {
        removeWelcome(guildId);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Welcome message disabled.')], ephemeral: true });
      } else {
        setWelcome(guildId, channel.id, msg);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Welcome message set in <#${channel.id}>.\n**Preview:** ${msg.replace('{user}', `<@${interaction.user.id}>`).replace('{server}', interaction.guild!.name)}`)], ephemeral: true });
      }
    } else if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel');
      if (!channel) {
        removeLogChannel(guildId);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Log channel disabled.')], ephemeral: true });
      } else {
        setLogChannel(guildId, channel.id);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Log channel set to <#${channel.id}>.`)], ephemeral: true });
      }
    } else if (sub === 'tempvc') {
      const channel = interaction.options.getChannel('channel');
      if (!channel) {
        removeTempVcHub(guildId);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Temporary voice channel hub disabled.')], ephemeral: true });
      } else {
        setTempVcHub(guildId, channel.id);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Temporary VC hub set to <#${channel.id}>.\nJoining that channel will now create a private temp channel.`)], ephemeral: true });
      }
    } else if (sub === 'language') {
      const lang = interaction.options.getString('lang', true);
      setLanguage(guildId, lang);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Bot language set to **${getLanguageName(lang)}** (\`${lang}\`).`)], ephemeral: true });
    } else if (sub === 'automod') {
      const enabled = interaction.options.getBoolean('enabled', true);
      setAutomodEnabled(guildId, enabled);
      const color = enabled ? 0x57f287 : 0xed4245;
      const status = enabled ? 'enabled' : 'disabled';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`AI auto-moderation ${status}.`)], ephemeral: true });
    } else {
      // show
      const autorole = getAutorole(guildId);
      const welcome  = getWelcome(guildId);
      const logCh    = getLogChannel(guildId);
      const tempVc   = getTempVcHub(guildId);
      const automod  = isAutomodEnabled(guildId);
      const lang     = getLanguage(guildId);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Server Configuration')
        .addFields(
          { name: 'Autorole',        value: autorole ? `<@&${autorole}>` : 'Disabled', inline: true },
          { name: 'Welcome channel', value: welcome ? `<#${welcome.channelId}>` : 'Disabled', inline: true },
          { name: 'Log channel',     value: logCh ? `<#${logCh}>` : 'Disabled', inline: true },
          { name: 'Temp VC hub',     value: tempVc ? `<#${tempVc}>` : 'Disabled', inline: true },
          { name: 'AI Auto-mod',     value: automod ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Language',        value: `${getLanguageName(lang)} (\`${lang}\`)`, inline: true },
        );
      if (welcome) embed.addFields({ name: 'Welcome message', value: welcome.message });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default config;
