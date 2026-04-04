import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const banner: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Display a user\'s banner')
    .addUserOption((opt) => opt.setName('user').setDescription('User (default: yourself)').setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const user   = await target.fetch(true);
    const url    = user.bannerURL({ size: 4096 });

    if (!url) {
      await interaction.reply({ content: `${user.tag} has no banner.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(user.accentColor ?? 0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setImage(url);

    await interaction.reply({ embeds: [embed] });
  },
};

export default banner;
