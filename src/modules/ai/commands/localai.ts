import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { config } from '../../../services/config';
import {
  getSystemPrompt, setSystemPrompt, resetSystemPrompt,
  getCloudPrompt, setCloudPrompt, resetCloudPrompt,
  addKnowledge, listKnowledge, removeKnowledge, clearKnowledge,
  isThinkingEnabled, setThinking,
} from '../../../services/localaiConfig';

function isBotOwner(userId: string): boolean {
  return !!config.BOT_OWNER_ID && userId === config.BOT_OWNER_ID;
}

const localai: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('localai')
    .setDescription('Manage local AI settings (bot owner only)')
    .addSubcommand((sub) =>
      sub
        .setName('prompt')
        .setDescription('Set a custom system prompt for local AI')
        .addStringOption((opt) =>
          opt.setName('text').setDescription('New system prompt (or attach a .txt file)').setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt.setName('file').setDescription('Upload a .txt file with the system prompt').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset-prompt')
        .setDescription('Reset system prompt to default')
    )
    .addSubcommand((sub) =>
      sub
        .setName('knowledge-add')
        .setDescription('Add an entry to the knowledge base (RAG)')
        .addStringOption((opt) =>
          opt.setName('topic').setDescription('Topic/keyword for this entry').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('content').setDescription('Knowledge content (or attach a .txt file for long content)').setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt.setName('file').setDescription('Upload a .txt or .md file with knowledge content').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('knowledge-list')
        .setDescription('List all knowledge base entries')
    )
    .addSubcommand((sub) =>
      sub
        .setName('knowledge-remove')
        .setDescription('Remove a knowledge entry by ID')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Entry ID to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('knowledge-clear')
        .setDescription('Clear all knowledge base entries')
    )
    .addSubcommand((sub) =>
      sub
        .setName('thinking')
        .setDescription('Toggle thinking mode (model shows reasoning before answering)')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable or disable thinking mode').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cloud-prompt')
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
        .setName('reset-cloud-prompt')
        .setDescription('Reset cloud AI prompt to default')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Show AI configuration status')
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
        const promptFile = interaction.options.getAttachment('file');

        if (promptFile) {
          if (!promptFile.name?.match(/\.(txt|md|text)$/i)) {
            await interaction.reply({ content: 'Only .txt and .md files are supported.', ephemeral: true });
            return;
          }
          const res = await fetch(promptFile.url);
          text = await res.text();
        }

        if (!text) {
          const current = getSystemPrompt();
          const embed = new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle('Local AI — System Prompt')
            .setDescription(current
              ? `\`\`\`\n${current.slice(0, 4000)}\n\`\`\``
              : '*Using default system prompt.*')
            .setFooter({ text: '/localai prompt <text> or attach a .txt file' });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        setSystemPrompt(text);
        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle('Local AI — Prompt Updated')
          .setDescription(`\`\`\`\n${text.slice(0, 4000)}\n\`\`\``)
          .addFields({ name: 'Size', value: `${text.length} chars`, inline: true })
          .setFooter({ text: 'Active for all local AI responses' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'reset-prompt': {
        resetSystemPrompt();
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x00b894).setTitle('Local AI — Prompt Reset').setDescription('System prompt reset to default.')],
          ephemeral: true,
        });
        return;
      }

      case 'knowledge-add': {
        const topic = interaction.options.getString('topic', true);
        let content = interaction.options.getString('content') ?? '';
        const file = interaction.options.getAttachment('file');

        // Read content from attached file if provided
        if (file) {
          if (!file.name?.match(/\.(txt|md|text)$/i)) {
            await interaction.reply({ content: 'Only .txt and .md files are supported.', ephemeral: true });
            return;
          }
          if (file.size > 1_000_000) {
            await interaction.reply({ content: 'File too large (max 1MB).', ephemeral: true });
            return;
          }
          const res = await fetch(file.url);
          content = await res.text();
        }

        if (!content.trim()) {
          await interaction.reply({ content: 'Provide content via text or attach a .txt file.', ephemeral: true });
          return;
        }

        const id = addKnowledge(topic, content);
        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle('Knowledge Base — Entry Added')
          .addFields(
            { name: 'ID', value: `${id}`, inline: true },
            { name: 'Topic', value: topic, inline: true },
            { name: 'Size', value: `${content.length} chars`, inline: true },
          )
          .setDescription(content.slice(0, 4000))
          .setFooter({ text: 'This knowledge will be injected into local AI context when relevant' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'knowledge-list': {
        const entries = listKnowledge();
        if (entries.length === 0) {
          await interaction.reply({ content: 'Knowledge base is empty. Use `/localai knowledge-add` to add entries.', ephemeral: true });
          return;
        }
        const lines = entries.map((e) => `**#${e.id}** — \`${e.topic}\`: ${e.content.slice(0, 80)}${e.content.length > 80 ? '...' : ''}`);
        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle(`Knowledge Base — ${entries.length} entries`)
          .setDescription(lines.join('\n').slice(0, 4000))
          .setFooter({ text: '/localai knowledge-remove <id> to delete' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'knowledge-remove': {
        const id = interaction.options.getInteger('id', true);
        const removed = removeKnowledge(id);
        await interaction.reply({
          content: removed ? `Knowledge entry #${id} removed.` : `Entry #${id} not found.`,
          ephemeral: true,
        });
        return;
      }

      case 'knowledge-clear': {
        const count = clearKnowledge();
        await interaction.reply({
          content: `Cleared ${count} knowledge entries.`,
          ephemeral: true,
        });
        return;
      }

      case 'thinking': {
        const enabled = interaction.options.getBoolean('enabled', true);
        setThinking(enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle('Local AI — Thinking Mode')
            .setDescription(enabled
              ? '**Enabled** — the model will reason before answering (slower but smarter).'
              : '**Disabled** — the model will answer directly (faster).')
          ],
          ephemeral: true,
        });
        return;
      }

      case 'cloud-prompt': {
        let cpText = interaction.options.getString('text') ?? '';
        const cpFile = interaction.options.getAttachment('file');
        if (cpFile) {
          if (!cpFile.name?.match(/\.(txt|md|text)$/i)) {
            await interaction.reply({ content: 'Only .txt and .md files are supported.', ephemeral: true });
            return;
          }
          const res = await fetch(cpFile.url);
          cpText = await res.text();
        }
        if (!cpText) {
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
        setCloudPrompt(cpText);
        const embed = new EmbedBuilder()
          .setColor(0x4285f4)
          .setTitle('Cloud AI — Prompt Updated')
          .setDescription(`\`\`\`\n${cpText.slice(0, 4000)}\n\`\`\``)
          .addFields({ name: 'Size', value: `${cpText.length} chars`, inline: true })
          .setFooter({ text: 'Active for all Claude + Gemini responses' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      case 'reset-cloud-prompt': {
        resetCloudPrompt();
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x4285f4).setTitle('Cloud AI — Prompt Reset').setDescription('Cloud system prompt reset to default.')],
          ephemeral: true,
        });
        return;
      }

      case 'status': {
        const prompt = getSystemPrompt();
        const cloudPrompt = getCloudPrompt();
        const entries = listKnowledge();
        const thinking = isThinkingEnabled();
        const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
        const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e4b';

        const embed = new EmbedBuilder()
          .setColor(0x00b894)
          .setTitle('AI — Status')
          .addFields(
            { name: 'Ollama Host', value: `\`${ollamaHost}\``, inline: true },
            { name: 'Default Model', value: `\`${ollamaModel}\``, inline: true },
            { name: 'Local Prompt', value: prompt ? `Custom (${prompt.length} chars)` : 'Default', inline: true },
            { name: 'Cloud Prompt', value: cloudPrompt ? `Custom (${cloudPrompt.length} chars)` : 'Default', inline: true },
            { name: 'Knowledge Base', value: `${entries.length} entries`, inline: true },
            { name: 'Thinking Mode', value: thinking ? 'Enabled' : 'Disabled', inline: true },
          )
          .setFooter({ text: '/localai prompt, cloud-prompt, knowledge-add, thinking' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }
  },
};

export default localai;
