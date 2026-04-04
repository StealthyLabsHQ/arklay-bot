import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const poll: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with buttons')
    .addStringOption((opt) => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption((opt) => opt.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption((opt) => opt.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption((opt) => opt.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption((opt) => opt.setName('option4').setDescription('Option 4').setRequired(false))
    .addStringOption((opt) => opt.setName('option5').setDescription('Option 5').setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString('question', true);
    const options: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    const votes = new Map<number, Set<string>>(); // optionIndex → userIds
    options.forEach((_, i) => votes.set(i, new Set()));

    const buildEmbed = () => {
      const totalVotes = [...votes.values()].reduce((sum, s) => sum + s.size, 0);
      const lines = options.map((opt, i) => {
        const count = votes.get(i)!.size;
        const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const bar   = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        return `${EMOJIS[i]} **${opt}**\n\`${bar}\` ${count} vote${count !== 1 ? 's' : ''} (${pct}%)`;
      });

      return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${question}`)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `${totalVotes} total vote${totalVotes !== 1 ? 's' : ''} • Ends in 5 minutes` });
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...options.map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`poll_${i}`)
          .setLabel(opt.slice(0, 80))
          .setEmoji(EMOJIS[i]!)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const reply = await interaction.reply({ embeds: [buildEmbed()], components: [row], fetchReply: true });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
    });

    collector.on('collect', async (btn) => {
      const idx = parseInt(btn.customId.split('_')[1]!, 10);
      // Remove previous vote
      for (const [, set] of votes) set.delete(btn.user.id);
      // Add new vote
      votes.get(idx)?.add(btn.user.id);
      await btn.update({ embeds: [buildEmbed()] });
    });

    collector.on('end', async () => {
      const finalEmbed = buildEmbed().setFooter({ text: 'Poll ended' }).setColor(0x99aab5);
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...options.map((opt, i) =>
          new ButtonBuilder()
            .setCustomId(`poll_${i}`)
            .setLabel(opt.slice(0, 80))
            .setEmoji(EMOJIS[i]!)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );
      await interaction.editReply({ embeds: [finalEmbed], components: [disabledRow] }).catch(() => undefined);
    });
  },
};

export default poll;
