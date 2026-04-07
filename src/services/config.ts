import { z } from 'zod';

const SNOWFLAKE_RE = /^\d{17,20}$/;
const PLACEHOLDER_RE = /^(your_[a-z0-9_]+_here|your_dev_guild_id_here|c:\/path\/to\/service-account-key\.json)$/i;

function isPlaceholder(value: string): boolean {
  const normalized = value.trim();
  return PLACEHOLDER_RE.test(normalized) || normalized.includes('/path/to/');
}

function booleanFromEnv(defaultValue: boolean): z.ZodEffects<z.ZodBoolean, boolean, unknown> {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return value;
  }, z.boolean());
}

function requiredEnv(name: string) {
  return z.string()
    .trim()
    .min(1, `${name} is required`)
    .refine((value) => !isPlaceholder(value), `${name} must be set to a real value`);
}

function optionalSecret(name: string) {
  return z.string()
    .trim()
    .refine((value) => value.length > 0, `${name} cannot be empty`)
    .refine((value) => !isPlaceholder(value), `${name} must be set to a real value`)
    .optional();
}

function discordSnowflake(name: string) {
  return z.string()
    .trim()
    .refine((value) => SNOWFLAKE_RE.test(value), `${name} must be a valid Discord snowflake`);
}

const envSchema = z.object({
  DISCORD_TOKEN: requiredEnv('DISCORD_TOKEN'),
  CLIENT_ID: discordSnowflake('CLIENT_ID'),
  GUILD_ID: z.string()
    .trim()
    .refine((value) => !isPlaceholder(value), 'GUILD_ID must be set to a real value')
    .refine(
      (value) => value.split(',').map((id) => id.trim()).filter(Boolean).every((id) => SNOWFLAKE_RE.test(id)),
      'GUILD_ID must contain valid Discord snowflakes'
    )
    .optional(),
  SPOTIFY_CLIENT_ID: optionalSecret('SPOTIFY_CLIENT_ID'),
  SPOTIFY_CLIENT_SECRET: optionalSecret('SPOTIFY_CLIENT_SECRET'),
  ANTHROPIC_API_KEY: optionalSecret('ANTHROPIC_API_KEY'),
  GOOGLE_AI_API_KEY: optionalSecret('GOOGLE_AI_API_KEY'),
  GOOGLE_CLOUD_PROJECT: optionalSecret('GOOGLE_CLOUD_PROJECT'),
  GOOGLE_CLOUD_REGION: z.string().trim().min(1).default('us-east5'),
  GOOGLE_APPLICATION_CREDENTIALS: optionalSecret('GOOGLE_APPLICATION_CREDENTIALS'),
  GIPHY_API_KEY: optionalSecret('GIPHY_API_KEY'),
  OPENAI_API_KEY: optionalSecret('OPENAI_API_KEY'),
  OLLAMA_ENABLED: booleanFromEnv(false),
  OLLAMA_HOST: z.string().trim().min(1).optional(),
  OLLAMA_MODEL: z.string().trim().min(1).optional(),
  OLLAMA_KEEP_ALIVE: z.string().trim().min(1).default('5m'),
  LAVALINK_HOST: z.string().trim().min(1).default('localhost:2333'),
  LAVALINK_PASSWORD: z.string().trim().min(1).default('youshallnotpass'),
  LAVALINK_SECURE: booleanFromEnv(false),
  BOT_OWNER_ID: discordSnowflake('BOT_OWNER_ID').optional(),
  BOT_OWNER_MULTIPLIER: z.coerce.number().min(0).max(20).default(5),
  BOT_PREFIX: z.string().trim().min(1).default('.'),
  BOT_NAME: z.string().trim().min(1).default('arklay'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${missing}`);
}

export const config = result.data;
export type Config = typeof config;

export function isBotOwner(userId: string): boolean {
  return !!config.BOT_OWNER_ID && userId === config.BOT_OWNER_ID;
}
