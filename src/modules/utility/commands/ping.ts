import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const ping: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Show bot latency') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const start = Date.now();
    await interaction.deferReply();
    const roundtrip = Date.now() - start;
    const ws = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(ws < 100 ? 0x57f287 : ws < 250 ? 0xfee75c : 0xed4245)
      .setTitle('Pong!')
      .addFields(
        { name: 'WebSocket',  value: `${ws}ms`,        inline: true },
        { name: 'Roundtrip',  value: `${roundtrip}ms`,  inline: true },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default ping;
