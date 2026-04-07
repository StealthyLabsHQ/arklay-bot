import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { CommandDef } from '../../../types';

const joinposition: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('joinposition')
    .setDescription('See the join position of a user in the server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guild  = interaction.guild!;
    const target = (interaction.options.getMember('user') ?? interaction.member) as GuildMember | null;
    if (!target) {
      await interaction.editReply('User not found.');
      return;
    }

    await guild.members.fetch();

    const sorted = guild.members.cache
      .filter((m) => m.joinedTimestamp !== null)
      .sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));

    const position = [...sorted.keys()].indexOf(target.id) + 1;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Join position — ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: 'Position', value: `**#${position}** of ${guild.memberCount}`, inline: true },
        { name: 'Joined',   value: target.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>` : 'Unknown', inline: true },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default joinposition;
