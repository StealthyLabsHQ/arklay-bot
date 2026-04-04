import { SlashCommandBuilder, EmbedBuilder, OAuth2Scopes, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const invite: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the bot invite link') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [PermissionFlagsBits.Administrator],
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Invite ${interaction.client.user?.username ?? 'Bot'}`)
      .setDescription(`[Click here to invite ${interaction.client.user?.username ?? 'the bot'} to your server](${url})`)
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? null);

    await interaction.reply({ embeds: [embed] });
  },
};

export default invite;
