import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

// guildId:userId → { reason, since }
const afkUsers = new Map<string, { reason: string; since: number }>();

export function getAfk(guildId: string, userId: string): { reason: string; since: number } | null {
  return afkUsers.get(`${guildId}:${userId}`) ?? null;
}

export function removeAfk(guildId: string, userId: string): boolean {
  return afkUsers.delete(`${guildId}:${userId}`);
}

const afk: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption((opt) => opt.setName('reason').setDescription('AFK reason').setRequired(false)) as SlashCommandBuilder,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const key    = `${interaction.guildId}:${interaction.user.id}`;
    const reason = interaction.options.getString('reason') ?? 'AFK';

    if (afkUsers.has(key)) {
      afkUsers.delete(key);
      await interaction.reply({ content: 'Welcome back! Your AFK status has been removed.', ephemeral: true });
      return;
    }

    afkUsers.set(key, { reason, since: Date.now() });

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setDescription(`${interaction.user} is now AFK: **${reason}**`);

    await interaction.reply({ embeds: [embed] });
  },
};

export default afk;
