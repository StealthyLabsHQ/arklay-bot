import { ApplicationCommandType, ContextMenuCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { MessageContextMenuCommandInteraction } from 'discord.js';
import type { ContextMenuDef } from '../../../types';

const stealSticker: ContextMenuDef = {
  data: new ContextMenuCommandBuilder()
    .setName('Steal Sticker')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions),
  guildOnly: true,

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const message = interaction.targetMessage;
    const sticker = message.stickers.first();

    if (!sticker) {
      await interaction.reply({ content: 'This message has no stickers.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const fetched = await sticker.fetch();

      const created = await interaction.guild.stickers.create({
        file: fetched.url,
        name: fetched.name,
        tags: fetched.tags ?? 'custom',
        reason: `Stolen by ${interaction.user.displayName}`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setDescription(`Added sticker **${created.name}**`)
        .setThumbnail(created.url);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await interaction.editReply(`Failed to add sticker: ${msg}`);
    }
  },
};

export default stealSticker;
