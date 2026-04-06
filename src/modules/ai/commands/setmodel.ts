import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { setAIConfig, getAIConfig, resetAIConfig, MODELS, type AIProvider } from '../../../services/aiConfig';
import { isAvailable as ollamaAvailable } from '../../../services/ai/ollama';

const CLOUD_CHOICES = [
  { name: 'Claude Sonnet 4.6', value: 'claude|claude-sonnet-4-6' },
  { name: 'Claude Opus 4.6 (most powerful)', value: 'claude|claude-opus-4-6' },
  { name: 'Claude Haiku 4.5 (fastest)', value: 'claude|claude-haiku-4-5' },
  { name: 'Gemini 3 Flash Preview', value: 'gemini|gemini-3-flash-preview' },
  { name: 'Gemini 3.1 Pro Preview (most powerful)', value: 'gemini|gemini-3.1-pro-preview' },
  { name: 'Gemini 3.1 Flash Lite (cheapest)', value: 'gemini|gemini-3.1-flash-lite-preview' },
];

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:26b';
const ollamaEnabled = ollamaAvailable();

const ALL_CHOICES = [...CLOUD_CHOICES];
if (ollamaEnabled) ALL_CHOICES.push({ name: `${OLLAMA_MODEL} (local)`, value: `ollama|${OLLAMA_MODEL}` });

function providerColor(p: string): number {
  if (p === 'claude') return 0xd4a843;
  if (p === 'ollama') return 0x00b894;
  return 0x4285f4;
}

function providerLabel(p: string): string {
  if (p === 'claude') return 'Anthropic Claude';
  if (p === 'ollama') return 'Local AI';
  return 'Google Gemini';
}

const builder = new SlashCommandBuilder()
  .setName('setmodel')
  .setDescription('Choose your personal AI model')
  .addSubcommand((sub) =>
    sub
      .setName('cloud')
      .setDescription('Use a cloud AI model (Claude or Gemini)')
      .addStringOption((opt) =>
        opt
          .setName('model')
          .setDescription('Cloud model to use')
          .setRequired(true)
          .addChoices(...CLOUD_CHOICES)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show your current AI model settings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset')
      .setDescription('Reset to the default model')
  );

if (ollamaEnabled) {
  builder.addSubcommand((sub) =>
    sub
      .setName('local')
      .setDescription(`Switch to local AI (${OLLAMA_MODEL})`)
  );
}

const setmodel: CommandDef = {
  data: builder as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand(false);

    // Text prefix fallback (no subcommand)
    if (!sub) {
      const raw = interaction.options.getString('model') ?? '';
      const lower = raw.toLowerCase().trim();
      if (!lower || lower === 'show') return showCurrent(interaction, userId);
      if (lower === 'reset') return doReset(interaction, userId);
      if (lower === 'local') {
        if (!ollamaEnabled) {
          await interaction.reply({ content: 'Local AI (Ollama) is not configured on this instance.', ephemeral: true });
          return;
        }
        return applyModel(interaction, userId, `ollama|${OLLAMA_MODEL}`);
      }
      if (lower === 'cloud') {
        const list = CLOUD_CHOICES.map((c) => `\`${c.name}\``).join(', ');
        await interaction.reply({ content: `Cloud models: ${list}\nUsage: \`.setmodel <model name>\``, ephemeral: true });
        return;
      }
      return handleTextPrefix(interaction, userId, raw);
    }

    if (sub === 'show') return showCurrent(interaction, userId);
    if (sub === 'reset') return doReset(interaction, userId);
    if (sub === 'local') return applyModel(interaction, userId, `ollama|${OLLAMA_MODEL}`);

    // cloud
    const value = interaction.options.getString('model', true);
    return applyModel(interaction, userId, value);
  },
};

async function doReset(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
  resetAIConfig(userId);
  const def = getAIConfig();
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('AI Model - Reset')
    .setDescription(`Back to default: **${def.model}**`)
    .setFooter({ text: 'Your personal setting' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showCurrent(interaction: ChatInputCommandInteraction, userId: string): Promise<void> {
  const cfg = getAIConfig(userId);
  const allModels = MODELS[cfg.provider];
  const modelLabel = allModels.find((m) => m.id === cfg.model)?.label ?? cfg.model;

  const embed = new EmbedBuilder()
    .setColor(providerColor(cfg.provider))
    .setTitle('AI Model - Your Settings')
    .addFields(
      { name: 'Provider', value: providerLabel(cfg.provider), inline: true },
      { name: 'Model', value: modelLabel, inline: true },
    )
    .setFooter({ text: '/setmodel cloud or /setmodel local to change' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function applyModel(interaction: ChatInputCommandInteraction, userId: string, value: string): Promise<void> {
  const [providerStr, modelId] = value.split('|') as [AIProvider, string];
  setAIConfig(providerStr, modelId, userId);

  const allModels = MODELS[providerStr];
  const modelLabel = allModels.find((m) => m.id === modelId)?.label ?? modelId;

  const embed = new EmbedBuilder()
    .setColor(providerColor(providerStr))
    .setTitle('AI Model - Saved')
    .addFields(
      { name: 'Provider', value: providerLabel(providerStr), inline: true },
      { name: 'Model', value: modelLabel, inline: true },
    )
    .setFooter({ text: 'Applies to your /ask and /summarize calls' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTextPrefix(interaction: ChatInputCommandInteraction, userId: string, raw: string): Promise<void> {
  const lower = raw.toLowerCase();
  const match = ALL_CHOICES.find((c) => c.name.toLowerCase().includes(lower) || c.value.toLowerCase().includes(lower));
  if (!match) {
    await interaction.reply({
      content: `Model not found: \`${raw}\`. Available: ${ALL_CHOICES.map((c) => `\`${c.name}\``).join(', ')}`,
      ephemeral: true,
    });
    return;
  }
  return applyModel(interaction, userId, match.value);
}

export default setmodel;
