import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { claudeAvailable, geminiAvailable, openaiAvailable } from '../../../services/ai/availability';
import OpenAIClient from 'openai';
import { withThinkingTimer } from '../../../services/thinkingTimer';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { isLimitReached, incrementUsage, remaining } from '../../../services/usageLimit';
import { DailyLimitError } from '../../../services/ai/router';
import { NetworkError, SafetyError, RateLimitError } from '../../../services/ai/anthropic';
import { getModelDisplayInfo } from '../../../services/aiConfig';
import { getCloudPrompt } from '../../../services/localaiConfig';
import { logger } from '../../../services/logger';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

const COOLDOWN_MS = 15_000;

const CODE_SYSTEM_PROMPT =
  'You are an expert software engineer. ' +
  'Provide clear, well-structured code with explanations. ' +
  'Use markdown code blocks with language tags (```python, ```typescript, etc). ' +
  'Be concise but thorough. Focus on best practices and clean code.';

const MODEL_CHOICES = [
  { name: 'GPT-5.3 Codex (code-optimized)', value: 'gpt-5.3-codex' },
  { name: 'GPT-5.4 (powerful)', value: 'gpt-5.4' },
  { name: 'GPT-5.4 Long Context (large files)', value: 'gpt-5.4-long-context' },
  { name: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { name: 'Claude Opus 4.6 (most powerful)', value: 'claude-opus-4-6' },
  { name: 'Gemini 3.1 Pro Thinking (deep reasoning)', value: 'gemini-3.1-pro-preview' },
];

const code: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('Generate or explain code with AI (full reasoning, temp 0)')
    .addStringOption((opt) =>
      opt.setName('prompt').setDescription('What code do you need?').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('model')
        .setDescription('AI model to use')
        .setRequired(true)
        .addChoices(...MODEL_CHOICES)
    )
    .addAttachmentOption((opt) =>
      opt.setName('file').setDescription('Upload a code file or screenshot to analyze').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('lang').setDescription('Response language (e.g. English, French)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (checkCooldown('code', interaction.user.id, COOLDOWN_MS)) {
      const secs = (remainingCooldown('code', interaction.user.id, COOLDOWN_MS) / 1000).toFixed(0);
      await interaction.reply({ content: `Cooldown — try again in ${secs}s.`, ephemeral: true });
      return;
    }

    const prompt = interaction.options.getString('prompt', true);
    const modelId = interaction.options.getString('model', true);
    const lang = interaction.options.getString('lang');
    const file = interaction.options.getAttachment('file');

    if (isLimitReached(interaction.user.id, modelId)) {
      await interaction.reply({ content: `Daily limit reached for **${modelId}**.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // Read attached file content (code file or image)
    let fileContent = '';
    let imageBase64 = '';
    let imageMime = '';

    if (file) {
      const isImage = file.contentType?.startsWith('image/') || file.name?.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i);

      if (isImage) {
        // Fetch image as base64 for vision analysis
        try {
          const res = await fetch(file.url);
          const buf = Buffer.from(await res.arrayBuffer());
          imageBase64 = buf.toString('base64');
          imageMime = file.contentType || 'image/png';
        } catch {
          await interaction.editReply('Failed to download the image.');
          return;
        }
      } else {
        // Read as text (code file)
        if (file.size > 500_000) {
          await interaction.editReply('File too large (max 500KB for code files).');
          return;
        }
        try {
          const res = await fetch(file.url);
          fileContent = await res.text();
        } catch {
          await interaction.editReply('Failed to download the file.');
          return;
        }
      }
    }

    let basePrompt = prompt;
    if (fileContent) {
      const ext = file?.name?.split('.').pop() || 'txt';
      basePrompt = `${prompt}\n\nHere is the code file (\`${file?.name}\`):\n\`\`\`${ext}\n${fileContent.slice(0, 50_000)}\n\`\`\``;
    }
    if (imageBase64) {
      basePrompt = `${prompt}\n\n[An image/screenshot has been attached for analysis]`;
    }

    const finalPrompt = lang ? `[Respond in ${lang}] ${basePrompt}` : basePrompt;
    const systemPrompt = getCloudPrompt() ?? CODE_SYSTEM_PROMPT;

    try {
      let text: string;
      let inputTokens = 0;
      let outputTokens = 0;
      let provider: 'claude' | 'gemini' | 'openai';

      if (modelId.startsWith('gpt-') || modelId.startsWith('o4')) {
        if (!openaiAvailable()) {
          await interaction.editReply('OpenAI is not available (missing API key).');
          return;
        }
        provider = 'openai';

        const oai = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
        const messages: OpenAIClient.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
        ];
        if (imageBase64) {
          messages.push({
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
              { type: 'text', text: finalPrompt },
            ],
          });
        } else {
          messages.push({ role: 'user', content: finalPrompt });
        }

        const maxTokens = modelId === 'gpt-5.4-long-context' ? 16384 : 4096;
        const response = await oai.chat.completions.create({
          model: modelId,
          messages,
          max_completion_tokens: maxTokens,
          temperature: 0,
        });

        text = response.choices[0]?.message?.content ?? '';
        if (!text) throw new SafetyError('Empty response from OpenAI');
        inputTokens = response.usage?.prompt_tokens ?? 0;
        outputTokens = response.usage?.completion_tokens ?? 0;
      } else if (modelId.startsWith('claude')) {
        if (!claudeAvailable()) {
          await interaction.editReply('Claude is not available (missing API key).');
          return;
        }
        provider = 'claude';

        let client: Anthropic | AnthropicVertex;
        if (!!process.env.GOOGLE_CLOUD_PROJECT) {
          client = new AnthropicVertex({
            projectId: process.env.GOOGLE_CLOUD_PROJECT!,
            region: process.env.GOOGLE_CLOUD_REGION ?? 'us-east5',
          });
        } else {
          client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }

        const userContent: Anthropic.ContentBlockParam[] = [];
        if (imageBase64) {
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: imageMime as 'image/png', data: imageBase64 },
          });
        }
        userContent.push({ type: 'text', text: finalPrompt });

        const response = await client.messages.create({
          model: modelId,
          max_tokens: 4096,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        });

        const block = response.content[0];
        if (block.type !== 'text') throw new SafetyError('Non-text response');
        text = block.text;
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
      } else {
        if (!geminiAvailable()) {
          await interaction.editReply('Gemini is not available (missing API key).');
          return;
        }
        provider = 'gemini';

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
        const model = genAI.getGenerativeModel({
          model: modelId,
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 8192 },
          } as Record<string, unknown>,
        });

        const geminiContent: unknown[] = [];
        if (imageBase64) {
          geminiContent.push({ inlineData: { mimeType: imageMime, data: imageBase64 } });
        }
        geminiContent.push(finalPrompt);

        const result = await model.generateContent(geminiContent as Parameters<typeof model.generateContent>[0]);
        text = result.response.text();
        const meta = result.response.usageMetadata;
        inputTokens = meta?.promptTokenCount ?? 0;
        outputTokens = meta?.candidatesTokenCount ?? 0;
      }

      incrementUsage(interaction.user.id, modelId);

      const { name: modelName, source } = getModelDisplayInfo(
        provider,
        modelId,
        provider === 'claude' && !!process.env.GOOGLE_CLOUD_PROJECT
      );
      const left = remaining(interaction.user.id, modelId);
      const quota = left !== null ? ` \u2022 ${left} req left` : '';
      const tokens = `${inputTokens + outputTokens} tokens (${inputTokens} in \u00b7 ${outputTokens} out)`;

      // Discord limit: 2000 chars. If longer, split into chunks
      const footer = `-# Generated by **${modelName}** (${source}) \u2022 temp 0 \u2022 ${tokens}${quota}`;

      if (text.length + footer.length + 2 <= 2000) {
        await interaction.editReply(`${text}\n${footer}`);
      } else {
        // Send code in chunks, footer on last
        const MAX = 1950;
        const chunks: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
          if (remaining.length <= MAX) {
            chunks.push(remaining);
            break;
          }
          // Try to split at newline
          let cut = remaining.lastIndexOf('\n', MAX);
          if (cut < MAX / 2) cut = MAX;
          chunks.push(remaining.slice(0, cut));
          remaining = remaining.slice(cut);
        }

        await interaction.editReply(chunks[0]!);
        for (let i = 1; i < chunks.length; i++) {
          const content = i === chunks.length - 1 ? `${chunks[i]}\n${footer}` : chunks[i]!;
          await interaction.followUp(content);
        }
        if (chunks.length === 1) {
          await interaction.followUp(footer);
        }
      }
    } catch (err) {
      logger.error({ err }, '/code failed');
      if (err instanceof DailyLimitError) {
        await interaction.editReply(`Daily limit reached for **${modelId}**.`);
      } else if (err instanceof RateLimitError) {
        await interaction.editReply('Rate limited — try again in a few seconds.');
      } else if (err instanceof SafetyError) {
        await interaction.editReply('This request could not be processed.');
      } else {
        await interaction.editReply('The AI service is temporarily unavailable.');
      }
    }
  },
};

export default code;
