import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Attachment, ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotOwner } from '../../../services/config';
import { getCloudPrompt, setCloudPrompt, resetCloudPrompt, getCodePrompt, setCodePrompt, resetCodePrompt, isCloudAIEnabled, setCloudAIEnabled } from '../../../services/localaiConfig';

async function readTextAttachment(file: Attachment, maxBytes = 25_000_000): Promise<string | null> {
  if (!file.name?.match(/\.(txt|md|text)$/i)) return null;
  if (file.size > maxBytes) return null;
  const res = await fetch(file.url);
  return res.text();
}

const cloudai: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('cloudai')
    .setDescription('Manage cloud AI settings (bot owner only)')
    .addSubcommand((sub) =>
      sub
        .setName('prompt')
        .setDescription('Set a custom system prompt for cloud AI (Claude + Gemini)')
        .addStringOption((opt) =>
          opt.setName('text').setDescription('New cloud prompt (or attach a .txt file)').setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt.setName('file').setDescription('Upload a .txt file with the prompt').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset-prompt')
        .setDescription('Reset cloud AI prompt to default')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Show cloud AI configuration status')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable cloud AI providers globally')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('True to enable, False to disable cloud AI').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('code-prompt')
        .setDescription('Set a custom system prompt for /code (overrides the built-in coding prompt)')
        .addStringOption((opt) =>
          opt.setName('text').setDescription('New code system prompt (or attach a .txt file)').setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt.setName('file').setDescription('Upload a .txt file with the prompt').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset-code-prompt')
        .setDescription('Reset /code system prompt to built-in default')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotOwner(interaction.user.id)) {
      await interaction.reply({ content: 'This command is restricted to the bot owner.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'prompt': {
        let text = interaction.options.getString('text') ?? '';
        const file = interaction.options.getAttachment('file');
        if (file) {
          const content = await readTextAttachment(file);
          if (content === null) {
            await interaction.reply({ content: 'Only .txt and .md files are supported.', ephemeral: true });
            return;
          }
          text = content;
        }
        if (!text) {
          const current = getCloudPrompt();
          const embed = new EmbedBuilder()
            .setColor(0x4285f4)
            .setTitle('Cloud AI — System Prompt')
            .setDescription(current
              ? `\`\`\`\n${current.slice(0, 4000)}\n\`\`\``
              : '*Using default system prompt.*')
            .setFooter({ text: 'Applies to Claude + Gemini' });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        setCloudPrompt(text);
        const embed = new EmbedBuilder()
          .setColor(0x4285f4)
          .setTitle('Cloud AI — Prompt Updated')
          .setDescription(`\`\`\`\n${text.slice(0, 4000)}\n\`\`\``)
          .addFields({ name: 'Size', value: `${text.length} chars`, inline: true })
          .setFooter({ text: 'Active for all Claude + Gemini responses' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'reset-prompt': {
        resetCloudPrompt();
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x4285f4).setTitle('Cloud AI — Prompt Reset').setDescription('Cloud system prompt reset to default.')],
          ephemeral: true,
        });
        return;
      }

      case 'status': {
        const cloudPrompt = getCloudPrompt();
        const codePrompt = getCodePrompt();
        const cloudEnabled = isCloudAIEnabled();
        const embed = new EmbedBuilder()
          .setColor(cloudEnabled ? 0x4285f4 : 0xe74c3c)
          .setTitle('Cloud AI — Status')
          .addFields(
            { name: 'Cloud AI', value: cloudEnabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Cloud Prompt', value: cloudPrompt ? `Custom (${cloudPrompt.length} chars)` : 'Default', inline: true },
            { name: 'Code Prompt', value: codePrompt ? `Custom (${codePrompt.length} chars)` : 'Built-in default', inline: true },
          )
          .setFooter({ text: '/cloudai toggle • /cloudai prompt • /cloudai code-prompt' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'code-prompt': {
        let text = interaction.options.getString('text') ?? '';
        const file = interaction.options.getAttachment('file');
        if (file) {
          const content = await readTextAttachment(file);
          if (content === null) {
            await interaction.reply({ content: 'Only .txt and .md files are supported.', ephemeral: true });
            return;
          }
          text = content;
        }
        if (!text) {
          const current = getCodePrompt();
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('Cloud AI — Code System Prompt')
            .setDescription(current
              ? `\`\`\`\n${current.slice(0, 4000)}\n\`\`\``
              : '*Using built-in default coding prompt.*')
            .setFooter({ text: 'Applies to /code only' });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        setCodePrompt(text);
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('Cloud AI — Code Prompt Updated')
          .setDescription(`\`\`\`\n${text.slice(0, 4000)}\n\`\`\``)
          .addFields({ name: 'Size', value: `${text.length} chars`, inline: true })
          .setFooter({ text: 'Active for all /code responses' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'reset-code-prompt': {
        resetCodePrompt();
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('Cloud AI — Code Prompt Reset').setDescription('Code system prompt reset to built-in default.')],
          ephemeral: true,
        });
        return;
      }

      case 'toggle': {
        const enabled = interaction.options.getBoolean('enabled', true);
        setCloudAIEnabled(enabled);
        const embed = new EmbedBuilder()
          .setColor(enabled ? 0x4285f4 : 0xe74c3c)
          .setTitle(`Cloud AI — ${enabled ? 'Enabled' : 'Disabled'}`)
          .setDescription(
            enabled
              ? 'Cloud AI providers (Claude, Gemini, OpenAI) are now active.'
              : 'Cloud AI is disabled. All requests will fall back to local AI only.'
          );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }
  },
};

export default cloudai;
