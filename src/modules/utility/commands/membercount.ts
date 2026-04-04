import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const membercount: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Show the server member count') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild!;
    const total = guild.memberCount;
    const bots  = guild.members.cache.filter((m) => m.user.bot).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .addFields(
        { name: 'Total',  value: `${total}`,         inline: true },
        { name: 'Humans', value: `${total - bots}`,   inline: true },
        { name: 'Bots',   value: `${bots}`,           inline: true },
      )
      .setThumbnail(guild.iconURL());

    await interaction.reply({ embeds: [embed] });
  },
};

export default membercount;
