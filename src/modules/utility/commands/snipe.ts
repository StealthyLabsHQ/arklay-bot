import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

export interface DeletedMessage {
  content: string;
  authorTag: string;
  authorAvatar: string | null;
  attachments: string[];
  timestamp: number;
}

export const deletedMessages = new Map<string, DeletedMessage>();

const snipe: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Show the last deleted message in this channel') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const deleted = deletedMessages.get(interaction.channelId);

    if (!deleted) {
      await interaction.reply({ content: 'Nothing to snipe.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setAuthor({
        name: deleted.authorTag,
        iconURL: deleted.authorAvatar ?? undefined,
      })
      .setDescription(deleted.content || '*No text content*')
      .setFooter({ text: 'Deleted' })
      .setTimestamp(deleted.timestamp);

    if (deleted.attachments.length > 0) {
      embed.addFields({
        name: 'Attachments',
        value: deleted.attachments.map((url) => `[Link](${url})`).join(', '),
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default snipe;
