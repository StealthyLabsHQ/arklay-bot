import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { generateImage, STYLE_PRESETS } from '../providers/google';
import { NetworkError, SafetyError, RateLimitError } from '../providers/anthropic';
import { ask } from '../router';
import { checkCooldown, remainingCooldown } from '../../../services/rateLimit';
import { isLimitReached, incrementUsage, remaining } from '../../../services/usageLimit';
import { logger } from '../../../services/logger';
import {
  getUserImageConfig,
  setUserImageConfig,
  resetUserImageConfig,
  DEFAULT_CONFIG,
  RESOLUTION_LABELS,
  RESOLUTION_LIMIT_KEY,
  type OutputFormat,
  type ImageResolution,
} from '../../../services/imageConfig';

const BASE_COOLDOWN_MS  = 20_000;
const MAX_COOLDOWN_MS   = 120_000;
const LEARN_MORE = 'https://stealthylabs.eu/docs/specter-bot';

// Adaptive cooldown - increases on API errors, decreases on success
let currentCooldown = BASE_COOLDOWN_MS;
let lastErrorTime   = 0;

function getCooldown(): number {
  // Decay back to base after 5 minutes of no errors
  if (Date.now() - lastErrorTime > 300_000) currentCooldown = BASE_COOLDOWN_MS;
  return currentCooldown;
}

function onGenerateSuccess(): void {
  // Gradually reduce cooldown on success (min = base)
  currentCooldown = Math.max(BASE_COOLDOWN_MS, Math.floor(currentCooldown * 0.7));
}

function onGenerateError(): void {
  lastErrorTime = Date.now();
  // Double cooldown on error (max = 2 minutes)
  currentCooldown = Math.min(MAX_COOLDOWN_MS, currentCooldown * 2);
  logger.info('[Nano Banana] Cooldown increased to %ds', currentCooldown / 1000);
}

const STYLE_CHOICES = [
  { name: 'Photorealistic', value: 'photorealistic' },
  { name: 'Anime', value: 'anime' },
  { name: 'Cartoon', value: 'cartoon' },
  { name: 'Oil Painting', value: 'oil_painting' },
  { name: 'Sketch', value: 'sketch' },
  { name: 'Pixel Art', value: 'pixel_art' },
  { name: 'Cinematic', value: 'cinematic' },
];

const nanobanana: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('nanobanana')
    .setDescription('Generate an image or configure your Nano Banana 2 image settings')
    // ── Generation options ──────────────────────────────────────────────
    .addStringOption((opt) =>
      opt
        .setName('prompt')
        .setDescription('Image description - provide this to generate an image')
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt
        .setName('image')
        .setDescription('Optional reference image (PNG, JPG, WEBP)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('style')
        .setDescription('Art style preset (generation only)')
        .setRequired(false)
        .addChoices(...STYLE_CHOICES)
    )
    .addStringOption((opt) =>
      opt
        .setName('ratio')
        .setDescription('Aspect ratio - overrides default for this generation, or saves as default when no prompt')
        .setRequired(false)
        .addChoices(
          { name: '1:1 - Square (default)', value: '1:1' },
          { name: '16:9 - Landscape', value: '16:9' },
          { name: '9:16 - Portrait', value: '9:16' },
          { name: '4:3 - Standard', value: '4:3' },
          { name: '3:4 - Portrait classic', value: '3:4' },
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('resolution')
        .setDescription('Output resolution - overrides default for this generation, or saves as default when no prompt')
        .setRequired(false)
        .addChoices(
          { name: '512px - Lightweight (15/day)', value: '512' },
          { name: '1K - Standard (10/day)', value: '1k' },
          { name: '2K - High quality (6/day)', value: '2k' },
          { name: '4K - Ultra quality (3/day)', value: '4k' },
        )
    )
    // ── Settings-only options ───────────────────────────────────────────
    .addNumberOption((opt) =>
      opt
        .setName('temperature')
        .setDescription('Creativity: 0.0 (precise) → 1.0 (expressive) - default 1.0')
        .setMinValue(0)
        .setMaxValue(1)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('output')
        .setDescription('Output format (settings only)')
        .setRequired(false)
        .addChoices(
          { name: 'Images & text (default)', value: 'images_text' },
          { name: 'Images only', value: 'images_only' },
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('system')
        .setDescription('Style instructions applied to all your images (empty = clear)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('enhance')
        .setDescription('AI-enhance your prompt with artistic details (default: true)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('default')
        .setDescription('Reset all your settings back to default')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId    = interaction.user.id;
    const prompt    = interaction.options.getString('prompt');
    const toDefault = interaction.options.getBoolean('default');

    // ── GENERATION MODE ───────────────────────────────────────────────
    if (prompt !== null) {
      const cd = getCooldown();
      if (checkCooldown('nanobanana', userId, cd)) {
        const secs = (remainingCooldown('nanobanana', userId, cd) / 1000).toFixed(0);
        const extra = cd > BASE_COOLDOWN_MS ? ' (API busy, cooldown extended)' : '';
        await interaction.reply({ content: `Cooldown active - try again in ${secs}s.${extra}`, ephemeral: true });
        return;
      }

      await interaction.deferReply();

      const userConfig = getUserImageConfig(userId);
      const ratio      = interaction.options.getString('ratio') ?? undefined;
      const style      = interaction.options.getString('style') ?? undefined;
      const resolution = (interaction.options.getString('resolution') ?? userConfig.defaultResolution) as ImageResolution;
      const limitKey   = RESOLUTION_LIMIT_KEY[resolution];

      if (isLimitReached(userId, limitKey)) {
        const limitVal = { '512': 15, '1k': 10, '2k': 6, '4k': 3 }[resolution];
        await interaction.editReply({
          content: `Daily limit reached for ${RESOLUTION_LABELS[resolution]} (${limitVal} images/day). Resets at midnight UTC.`,
        });
        return;
      }

      const attachment = interaction.options.getAttachment('image');
      let referenceImageBase64: string | undefined;
      let referenceImageMimeType: string | undefined;

      if (attachment) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(attachment.contentType ?? '')) {
          await interaction.editReply('Reference image must be PNG, JPG, or WEBP.');
          return;
        }
        try {
          const res    = await fetch(attachment.url);
          const buffer = await res.arrayBuffer();
          referenceImageBase64     = Buffer.from(buffer).toString('base64');
          referenceImageMimeType   = attachment.contentType ?? 'image/png';
        } catch {
          await interaction.editReply('Could not fetch the reference image.');
          return;
        }
      }

      // Prompt enhancement: enabled by default, opt out with enhance:false
      const enhance = interaction.options.getBoolean('enhance') ?? true;
      let finalPrompt = prompt;

      if (enhance) {
        try {
          const enhanceResult = await ask(
            interaction.guildId ?? 'dm',
            userId,
            `You are an image prompt engineer. Expand this basic prompt into a detailed, vivid image generation prompt. Keep the original intent. Add artistic details like composition, lighting, mood, colors, and style. Output ONLY the enhanced prompt, nothing else. Limit to 200 words.\n\nOriginal: ${prompt}`,
            'auto',
            false,
          );
          finalPrompt = enhanceResult.text;
        } catch {
          // Fall back to raw prompt if enhancement fails
          logger.warn('/nanobanana prompt enhancement failed, using raw prompt');
        }
      }

      try {
        const imageBuffer = await generateImage(finalPrompt, {
          aspectRatio: ratio,
          resolution,
          style,
          referenceImageBase64,
          referenceImageMimeType,
          userConfig,
        });

        incrementUsage(userId, limitKey);
        const left = remaining(userId, limitKey);

        const file         = new AttachmentBuilder(imageBuffer, { name: 'nanobanana.png' });
        const styleLabel   = style ? ` · ${style.replace('_', ' ')}` : '';
        const quotaLabel   = left !== null ? ` · ${left} left today` : '';
        const effectiveRatio = ratio ?? userConfig.defaultRatio;
        const resLabel     = RESOLUTION_LABELS[resolution];

        const embed = new EmbedBuilder()
          .setImage('attachment://nanobanana.png')
          .setFooter({ text: `${effectiveRatio} · ${resLabel}${styleLabel}` });

        const disclaimer = `-# Generated by **Nano Banana 2** (Google Gemini API) for ${interaction.user}. AI can make mistakes.${quotaLabel} · [Learn more](${LEARN_MORE})`;

        onGenerateSuccess();

        await interaction.editReply({
          content: disclaimer,
          files: [file],
          embeds: [embed],
          flags: ['SuppressEmbeds'],
        });
      } catch (err) {
        onGenerateError();
        logger.error({ err }, '/nanobanana generate failed');
        await interaction.editReply(errorMessage(err));
      }
      return;
    }

    // ── RESET ─────────────────────────────────────────────────────────
    if (toDefault) {
      resetUserImageConfig(userId);
      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle('Nano Banana 2 - Settings Reset')
        .setDescription('Your settings have been restored to default.')
        .addFields(
          { name: 'Temperature',    value: `${DEFAULT_CONFIG.temperature}`, inline: true },
          { name: 'Default ratio',  value: DEFAULT_CONFIG.defaultRatio,     inline: true },
          { name: 'Output format',  value: 'Images & text',                  inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── SETTINGS MODE ─────────────────────────────────────────────────
    const temperature = interaction.options.getNumber('temperature');
    const ratio       = interaction.options.getString('ratio');
    const output      = interaction.options.getString('output') as OutputFormat | null;
    const resolution  = interaction.options.getString('resolution') as ImageResolution | null;
    const system      = interaction.options.getString('system');

    const nothingProvided =
      temperature === null && ratio === null && output === null &&
      resolution === null && system === null;

    // Show current config
    if (nothingProvided) {
      const cfg = getUserImageConfig(userId);
      const isDefault =
        cfg.temperature         === DEFAULT_CONFIG.temperature &&
        cfg.defaultRatio        === DEFAULT_CONFIG.defaultRatio &&
        cfg.outputFormat        === DEFAULT_CONFIG.outputFormat &&
        cfg.systemInstructions  === DEFAULT_CONFIG.systemInstructions;

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setTitle('Nano Banana 2 - Your Settings')
        .setDescription('Use `/nanobanana prompt:<text>` to generate an image with your current settings.')
        .addFields(
          { name: 'Temperature',       value: `${cfg.temperature}`,                                                    inline: true },
          { name: 'Default ratio',     value: cfg.defaultRatio,                                                        inline: true },
          { name: 'Resolution',        value: RESOLUTION_LABELS[cfg.defaultResolution],                                inline: true },
          { name: 'Output format',     value: cfg.outputFormat === 'images_only' ? 'Images only' : 'Images & text',   inline: true },
          { name: 'Style instructions', value: cfg.systemInstructions || '*none*',                                     inline: false },
        )
        .setFooter({ text: isDefault ? 'Using default settings' : 'Custom settings active • use default:true to reset' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Apply changes
    const patch: Parameters<typeof setUserImageConfig>[1] = {};
    if (temperature !== null) patch.temperature       = temperature;
    if (ratio !== null)       patch.defaultRatio      = ratio;
    if (resolution !== null)  patch.defaultResolution = resolution;
    if (output !== null)      patch.outputFormat      = output;
    if (system !== null)      patch.systemInstructions = system;

    const cfg = setUserImageConfig(userId, patch);

    const lines: string[] = [];
    if (temperature !== null) lines.push(`Temperature → **${cfg.temperature}**`);
    if (ratio !== null)       lines.push(`Default ratio → **${cfg.defaultRatio}**`);
    if (resolution !== null)  lines.push(`Resolution → **${RESOLUTION_LABELS[cfg.defaultResolution]}**`);
    if (output !== null)      lines.push(`Output → **${cfg.outputFormat}**`);
    if (system !== null)      lines.push(`Style instructions → ${cfg.systemInstructions ? `*"${cfg.systemInstructions}"*` : '*cleared*'}`);

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle('Nano Banana 2 - Settings Saved')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Your settings apply to all your /nanobanana generations' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function errorMessage(err: unknown): string {
  if (err instanceof RateLimitError) return 'Too many requests, please try again in a few seconds.';
  if (err instanceof SafetyError)    return 'This request could not be processed.';
  if (err instanceof NetworkError)   return 'The AI service is temporarily unavailable.';
  return 'The AI service is temporarily unavailable.';
}

export default nanobanana;
