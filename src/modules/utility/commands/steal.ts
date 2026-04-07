import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const CUSTOM_EMOJI_RE = /^<(a?):(\w+):(\d+)>$/;

const steal: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Add an external emoji to this server')
    .addStringOption((opt) =>
      opt.setName('emoji').setDescription('The custom emoji to steal').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Custom name for the emoji (optional)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const input = interaction.options.getString('emoji', true).trim();
    const match = CUSTOM_EMOJI_RE.exec(input);

    if (!match) {
      await interaction.reply({ content: 'Please provide a valid custom emoji.', ephemeral: true });
      return;
    }

    const [, animated, defaultName, id] = match;
    const customName = interaction.options.getString('name')?.replace(/\s+/g, '_') ?? defaultName!;
    const ext = animated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=256`;

    await interaction.deferReply();

    try {
      const created = await interaction.guild.emojis.create({
        attachment: url,
        name: customName,
        reason: `Stolen by ${interaction.user.displayName}`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setDescription(`Added ${created} as \`:${created.name}:\``)
        .setThumbnail(created.imageURL());

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await interaction.editReply(`Failed to add emoji: ${msg}`);
    }
  },
};

export default steal;
