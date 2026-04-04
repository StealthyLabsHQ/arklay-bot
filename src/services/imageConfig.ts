// Per-user image generation settings - SQLite persistent
import db from './db';

export type OutputFormat = 'images_text' | 'images_only';

export type ImageResolution = '512' | '1k' | '2k' | '4k';

export const RESOLUTION_LABELS: Record<ImageResolution, string> = {
  '512': '512px',
  '1k':  '1K',
  '2k':  '2K',
  '4k':  '4K',
};

export const RESOLUTION_LIMIT_KEY: Record<ImageResolution, string> = {
  '512': 'gemini-image-512',
  '1k':  'gemini-image-1k',
  '2k':  'gemini-image-2k',
  '4k':  'gemini-image-4k',
};

export const RESOLUTION_PROMPT: Record<ImageResolution, string> = {
  '512': 'small 512px resolution',
  '1k':  '1K resolution',
  '2k':  'high quality 2K resolution',
  '4k':  'ultra high quality 4K resolution',
};

export interface ImageGenConfig {
  temperature: number;
  defaultRatio: string;
  defaultResolution: ImageResolution;
  systemInstructions: string;
  outputFormat: OutputFormat;
}

export const DEFAULT_CONFIG: Readonly<ImageGenConfig> = {
  temperature: 1,
  defaultRatio: '1:1',
  defaultResolution: '1k',
  systemInstructions: '',
  outputFormat: 'images_text',
};

const stmtGet = db.prepare(
  'SELECT temperature, default_ratio, default_resolution, system_instructions, output_format FROM image_config WHERE user_id = ?'
);
const stmtSet = db.prepare(`
  INSERT INTO image_config (user_id, temperature, default_ratio, default_resolution, system_instructions, output_format)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    temperature = excluded.temperature,
    default_ratio = excluded.default_ratio,
    default_resolution = excluded.default_resolution,
    system_instructions = excluded.system_instructions,
    output_format = excluded.output_format
`);
const stmtDel = db.prepare('DELETE FROM image_config WHERE user_id = ?');

interface ImageConfigRow {
  temperature: number;
  default_ratio: string;
  default_resolution: ImageResolution;
  system_instructions: string;
  output_format: OutputFormat;
}

function rowToConfig(row: ImageConfigRow): ImageGenConfig {
  return {
    temperature: row.temperature,
    defaultRatio: row.default_ratio,
    defaultResolution: row.default_resolution,
    systemInstructions: row.system_instructions,
    outputFormat: row.output_format,
  };
}

export function getUserImageConfig(userId: string): ImageGenConfig {
  const row = stmtGet.get(userId) as ImageConfigRow | undefined;
  return row ? rowToConfig(row) : { ...DEFAULT_CONFIG };
}

export function setUserImageConfig(userId: string, patch: Partial<ImageGenConfig>): ImageGenConfig {
  const current = getUserImageConfig(userId);
  const updated = { ...current, ...patch };
  stmtSet.run(userId, updated.temperature, updated.defaultRatio, updated.defaultResolution, updated.systemInstructions, updated.outputFormat);
  return updated;
}

export function resetUserImageConfig(userId: string): void {
  stmtDel.run(userId);
}
