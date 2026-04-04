import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

export interface EditedMessage {
  oldContent: string;
  newContent: string;
  authorTag: string;
  authorAvatar: string | null;
  messageUrl: string;
  timestamp: number;
}

export const editedMessages = new Map<string, EditedMessage>();

const editsnipe: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('Show the previous version of the last edited message in this channel') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const edited = editedMessages.get(interaction.channelId);

    if (!edited) {
      await interaction.reply({ content: 'Nothing to editsnipe.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setAuthor({
        name: edited.authorTag,
        iconURL: edited.authorAvatar ?? undefined,
      })
      .addFields(
        { name: 'Before', value: edited.oldContent || '*Empty*' },
        { name: 'After',  value: edited.newContent || '*Empty*' },
      )
      .setFooter({ text: 'Edited' })
      .setTimestamp(edited.timestamp);

    await interaction.reply({ embeds: [embed] });
  },
};

export default editsnipe;
