import type { ChatInputCommandInteraction } from 'discord.js';

/**
 * Shows a "thinking" timer that updates every 3 seconds while waiting for a promise.
 * Returns the result of the promise.
 */
export async function withThinkingTimer<T>(
  interaction: ChatInputCommandInteraction,
  task: Promise<T>,
  botName?: string,
): Promise<T> {
  const name = botName ?? interaction.client.user?.username ?? 'AI';
  const start = Date.now();
  let done = false;

  // Update the deferred reply with a timer
  const update = async () => {
    if (done) return;
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    await interaction.editReply(`${name} is thinking... (${elapsed}s)`).catch(() => undefined);
  };

  // Start updating every 3 seconds
  await update();
  const interval = setInterval(() => { update(); }, 3000);

  try {
    const result = await task;
    done = true;
    clearInterval(interval);
    return result;
  } catch (err) {
    done = true;
    clearInterval(interval);
    throw err;
  }
}
