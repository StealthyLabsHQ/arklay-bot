import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { setAIConfig, getAIConfig, resetAIConfig, MODELS, type AIProvider } from '../../../services/aiConfig';

const CHOICES = [
  // Claude models
  { name: 'Claude Sonnet 4.6', value: 'claude|claude-sonnet-4-6' },
  { name: 'Claude Opus 4.6 (most powerful)', value: 'claude|claude-opus-4-6' },
  { name: 'Claude Haiku 4.5 (fastest)', value: 'claude|claude-haiku-4-5' },
  // Gemini models
  { name: 'Gemini 3 Flash Preview', value: 'gemini|gemini-3-flash-preview' },
  { name: 'Gemini 3.1 Pro Preview (most powerful)', value: 'gemini|gemini-3.1-pro-preview' },
  { name: 'Gemini 3.1 Flash Lite (cheapest)', value: 'gemini|gemini-3.1-flash-lite-preview' },
];

const setmodel: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('setmodel')
    .setDescription('Choose your personal AI model for /ask and /summarize')
    .addStringOption((opt) =>
      opt
        .setName('model')
        .setDescription('Model to use')
        .setRequired(false)
        .addChoices(...CHOICES)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('default')
        .setDescription('Reset to the default model')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId   = interaction.user.id;
    const toDefault = interaction.options.getBoolean('default');
    const value     = interaction.options.getString('model');

    // Reset to default
    if (toDefault) {
      resetAIConfig(userId);
      const def = getAIConfig();
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('AI Model - Reset')
        .setDescription(`Back to default: **${def.model}**`)
        .setFooter({ text: 'Your personal setting' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Fuzzy match for text prefix commands (e.g. "arklay setmodel gemini flash lite")
    let resolved = value;
    if (resolved && !resolved.includes('|')) {
      const lower = resolved.toLowerCase();
      const match = CHOICES.find((c) => c.name.toLowerCase().includes(lower));
      if (match) {
        resolved = match.value;
      } else {
        await interaction.reply({ content: `Model not found: \`${resolved}\`. Available: ${CHOICES.map((c) => `\`${c.name}\``).join(', ')}`, ephemeral: true });
        return;
      }
    }

    // No option → show current
    if (!resolved) {
      const cfg = getAIConfig(userId);
      const providerLabel = cfg.provider === 'claude' ? 'Anthropic Claude' : 'Google Gemini';
      const allModels = MODELS[cfg.provider];
      const modelLabel = allModels.find((m) => m.id === cfg.model)?.label ?? cfg.model;

      const embed = new EmbedBuilder()
        .setColor(cfg.provider === 'claude' ? 0xd4a843 : 0x4285f4)
        .setTitle('AI Model - Your Settings')
        .addFields(
          { name: 'Provider', value: providerLabel, inline: true },
          { name: 'Model',    value: modelLabel,     inline: true },
        )
        .setFooter({ text: 'Use /setmodel model:<choice> to change' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Set new model
    const [providerStr, modelId] = resolved!.split('|') as [AIProvider, string];
    setAIConfig(providerStr, modelId, userId);

    const providerLabel = providerStr === 'claude' ? 'Anthropic Claude' : 'Google Gemini';
    const allModels = MODELS[providerStr];
    const modelLabel = allModels.find((m) => m.id === modelId)?.label ?? modelId;

    const embed = new EmbedBuilder()
      .setColor(providerStr === 'claude' ? 0xd4a843 : 0x4285f4)
      .setTitle('AI Model - Saved')
      .addFields(
        { name: 'Provider', value: providerLabel, inline: true },
        { name: 'Model',    value: modelLabel,     inline: true },
      )
      .setFooter({ text: 'Applies to your /ask and /summarize calls' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default setmodel;
