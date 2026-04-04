import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const CUSTOM_EMOJI_RE = /^<(a?):(\w+):(\d+)>$/;

const emoji: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Get info and full-size image of an emoji or sticker')
    .addStringOption((opt) =>
      opt.setName('emoji').setDescription('Custom emoji to inspect').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('emoji', true).trim();

    const match = CUSTOM_EMOJI_RE.exec(input);
    if (!match) {
      await interaction.reply({ content: 'Please provide a custom emoji (e.g. `:name:`). Default Unicode emojis are not supported.', ephemeral: true });
      return;
    }

    const [, animated, name, id] = match;
    const ext = animated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=512`;

    const guildEmoji = interaction.guild?.emojis.cache.get(id!);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`:${name}:`)
      .setImage(url)
      .addFields(
        { name: 'ID', value: `\`${id}\``, inline: true },
        { name: 'Animated', value: animated ? 'Yes' : 'No', inline: true },
      );

    if (guildEmoji) {
      embed.addFields(
        { name: 'Server emoji', value: 'Yes', inline: true },
        { name: 'Created', value: `<t:${Math.floor(guildEmoji.createdTimestamp / 1000)}:R>`, inline: true },
      );
      if (guildEmoji.roles.cache.size > 0) {
        embed.addFields({
          name: 'Restricted to',
          value: guildEmoji.roles.cache.map((r) => `${r}`).join(', '),
          inline: true,
        });
      }
    } else {
      embed.addFields({ name: 'Server emoji', value: 'No (external)', inline: true });
    }

    embed.addFields({ name: 'URL', value: `[Open image](${url})` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default emoji;
