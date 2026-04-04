import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

const MAX_DURATION_MS = 86_400_000; // 24 hours

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)\s*(m|min|h|hr|hour|d|day|s|sec)s?$/i);
  if (!match) return null;
  const num  = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith('s'))  return num * 1000;
  if (unit.startsWith('m'))  return num * 60_000;
  if (unit.startsWith('h'))  return num * 3_600_000;
  if (unit.startsWith('d'))  return num * 86_400_000;
  return null;
}

const remindme: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a reminder (max 24h)')
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('When to remind (e.g. 30m, 2h, 1d)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('message').setDescription('What to remind you about').setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const durationStr = interaction.options.getString('duration', true);
    const message     = interaction.options.getString('message', true);
    const ms          = parseDuration(durationStr);

    if (!ms || ms < 1000) {
      await interaction.reply({ content: 'Invalid duration. Use formats like `30m`, `2h`, `1d`.', ephemeral: true });
      return;
    }

    if (ms > MAX_DURATION_MS) {
      await interaction.reply({ content: 'Maximum reminder duration is 24 hours.', ephemeral: true });
      return;
    }

    const fireAt = Math.floor((Date.now() + ms) / 1000);

    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Reminder')
          .setDescription(message)
          .setFooter({ text: `Set ${durationStr} ago` });

        await interaction.user.send({ embeds: [embed] });
      } catch {
        // DMs closed - try to ping in the original channel
        const channel = interaction.channel;
        if (channel && 'send' in channel) {
          await channel.send({ content: `<@${interaction.user.id}> **Reminder:** ${message}` }).catch(() => undefined);
        }
      }
    }, ms);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Reminder Set')
      .setDescription(`I'll remind you <t:${fireAt}:R>`)
      .addFields({ name: 'Message', value: message })
      .setFooter({ text: 'Reminders are lost if the bot restarts' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default remindme;
