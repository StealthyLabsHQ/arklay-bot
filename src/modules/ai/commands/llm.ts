import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { getAIConfig, MODELS, getModelDisplayInfo } from '../../../services/aiConfig';
const isVertexMode = () => !!process.env.GOOGLE_CLOUD_PROJECT;
import { claudeAvailable, geminiAvailable, openaiAvailable, ollamaAvailable } from '../../../services/ai/availability';
import { remaining, limitStatus } from '../../../services/usageLimit';

function providerIcon(p: string): string {
  if (p === 'claude') return '\uD83D\uDFE0';
  if (p === 'gemini') return '\uD83D\uDD35';
  if (p === 'openai') return '\uD83D\uDFE2';
  if (p === 'ollama') return '\uD83D\uDFE3';
  return '\u2B1C';
}

function providerCompany(p: string): string {
  if (p === 'claude') return 'Anthropic';
  if (p === 'gemini') return 'Google';
  if (p === 'openai') return 'OpenAI';
  if (p === 'ollama') return 'Local (Ollama)';
  return 'Unknown';
}

const llm: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('llm')
    .setDescription('Show your current AI model and available providers') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const cfg = getAIConfig(userId);

    const { name: modelName, source } = getModelDisplayInfo(
      cfg.provider,
      cfg.model,
      cfg.provider === 'claude' && isVertexMode()
    );

    const modelList = MODELS[cfg.provider];
    const modelLabel = modelList.find((m) => m.id === cfg.model)?.label ?? cfg.model;

    // Usage info
    const left = remaining(userId, cfg.model);
    const status = limitStatus(userId, cfg.model);
    const quotaLine = status ? `${status}` : 'Unlimited';

    // Available providers
    const providers = [
      { name: 'Anthropic (Claude)', available: claudeAvailable(), id: 'claude' },
      { name: 'Google (Gemini)', available: geminiAvailable(), id: 'gemini' },
      { name: 'OpenAI (ChatGPT)', available: openaiAvailable(), id: 'openai' },
      { name: 'Ollama (Local)', available: ollamaAvailable(), id: 'ollama' },
    ];

    const providerList = providers
      .map((p) => `${p.available ? '\u2705' : '\u274C'} ${p.name}${cfg.provider === p.id ? ' \u2190 **active**' : ''}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(cfg.provider === 'claude' ? 0xd4a843 : cfg.provider === 'openai' ? 0x10a37f : cfg.provider === 'ollama' ? 0x00b894 : 0x4285f4)
      .setTitle(`${providerIcon(cfg.provider)} Your AI Configuration`)
      .addFields(
        { name: 'Provider', value: providerCompany(cfg.provider), inline: true },
        { name: 'Model', value: modelName, inline: true },
        { name: 'Model ID', value: `\`${cfg.model}\``, inline: true },
        { name: 'Source', value: source, inline: true },
        { name: 'Usage', value: quotaLine, inline: true },
        { name: 'Requests Left', value: left !== null ? `${left}` : 'Unlimited', inline: true },
        { name: 'Available Providers', value: providerList },
      )
      .setFooter({ text: '/setmodel to change \u2022 /llm to check' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default llm;
