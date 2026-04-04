import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  GUILD_ID: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  // Vertex AI (Claude via Google Cloud)
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_REGION: z.string().default('us-east5'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  BOT_OWNER_ID: z.string().optional(),
  BOT_OWNER_MULTIPLIER: z.coerce.number().min(0).max(20).default(5),
  BOT_PREFIX: z.string().default('.'),
  BOT_NAME: z.string().default('arklay'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${missing}`);
}

export const config = result.data;
export type Config = typeof config;
