import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import db from '../../../services/db';

const stmtGet = db.prepare('SELECT persona FROM user_persona WHERE user_id = ?');
const stmtSet = db.prepare('INSERT INTO user_persona (user_id, persona) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET persona = excluded.persona');
const stmtDel = db.prepare('DELETE FROM user_persona WHERE user_id = ?');

const PRESETS: Record<string, string> = {
  pirate: 'You are a pirate. Speak like a pirate with "arr", "matey", nautical terms. Stay in character.',
  professor: 'You are a university professor. Be scholarly, use academic language, cite examples.',
  yoda: 'You are Yoda from Star Wars. Speak with inverted sentence structure. Wise and cryptic.',
  sarcastic: 'You are extremely sarcastic. Every answer drips with irony and witty remarks.',
  poet: 'You are a romantic poet. Respond in poetic verse with metaphors and rhymes.',
  chef: 'You are a passionate French chef. Use culinary metaphors, occasional French words.',
  detective: 'You are a noir detective. Speak in hardboiled style, use mystery metaphors.',
  anime: 'You are an enthusiastic anime character. Use expressions like "sugoi!", "nani?!", dramatic reactions.',
};

export function getPersona(userId: string): string | null {
  const row = stmtGet.get(userId) as { persona: string } | undefined;
  return row?.persona ?? null;
}

const persona: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('persona')
    .setDescription('Set a personality for AI responses')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Choose a preset personality')
        .addStringOption((opt) =>
          opt
            .setName('style')
            .setDescription('Personality style')
            .setRequired(true)
            .addChoices(
              ...Object.keys(PRESETS).map((k) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: k }))
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('custom')
        .setDescription('Set a custom persona')
        .addStringOption((opt) =>
          opt.setName('prompt').setDescription('Custom persona description').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('show').setDescription('Show your current persona')
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Remove your persona (back to default)')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'set': {
        const style = interaction.options.getString('style', true);
        const prompt = PRESETS[style];
        if (!prompt) { await interaction.reply({ content: 'Unknown style.', ephemeral: true }); return; }
        stmtSet.run(userId, prompt);
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('Persona Set').setDescription(`**${style.charAt(0).toUpperCase() + style.slice(1)}** — AI will respond in this style.`)],
          ephemeral: true,
        });
        return;
      }
      case 'custom': {
        const custom = interaction.options.getString('prompt', true).slice(0, 500);
        stmtSet.run(userId, custom);
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('Custom Persona Set').setDescription(`\`\`\`\n${custom}\n\`\`\``)],
          ephemeral: true,
        });
        return;
      }
      case 'show': {
        const current = getPersona(userId);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Your Persona')
            .setDescription(current ? `\`\`\`\n${current}\n\`\`\`` : '*No persona set — using default AI.*')
          ],
          ephemeral: true,
        });
        return;
      }
      case 'reset': {
        stmtDel.run(userId);
        await interaction.reply({ content: 'Persona removed. AI will use default behavior.', ephemeral: true });
        return;
      }
    }
  },
};

export default persona;
