import type { BotModule } from '../../types';
import { isAvailable as claudeAvailable, isVertexMode } from './providers/anthropic';
import { isAvailable as geminiAvailable } from './providers/google';
import { logger } from '../../services/logger';
import askCommand from './commands/ask';
import summarize from './commands/summarize';
import setmodel from './commands/setmodel';
import nanobanana from './commands/nanobanana';
import translate from './commands/translate';
import roast from './commands/roast';

const hasAnyProvider = claudeAvailable() || geminiAvailable();

if (!hasAnyProvider) {
  logger.warn('ai module: No AI provider keys found - module disabled');
} else {
  if (claudeAvailable()) {
    const via = isVertexMode() ? 'via Vertex AI (GCP)' : 'via direct API';
    logger.info('ai module: Claude provider enabled (%s)', via);
  }
  if (geminiAvailable()) logger.info('ai module: Gemini provider enabled');
  else logger.info('ai module: /nanobanana generation disabled (no GOOGLE_AI_API_KEY)');
}

import vision from './commands/vision';
import catchup from './commands/catchup';
import tldr from './commands/tldr';

const commands = [askCommand, summarize, setmodel, nanobanana, translate, roast, vision, catchup, tldr];

const aiModule: BotModule = {
  name: 'ai',
  enabled: hasAnyProvider,
  commands,
};

export default aiModule;
