// Per-user cooldown store. Keys: `${commandName}:${userId}`
const cooldowns = new Map<string, number>();

/**
 * Returns true if the user is on cooldown, false if they can proceed.
 * Also sets the cooldown when the user is allowed through.
 */
export function checkCooldown(commandName: string, userId: string, cooldownMs: number): boolean {
  const key = `${commandName}:${userId}`;
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;

  if (now - last < cooldownMs) return true; // still on cooldown

  cooldowns.set(key, now);
  return false;
}

export function remainingCooldown(commandName: string, userId: string, cooldownMs: number): number {
  const key = `${commandName}:${userId}`;
  const last = cooldowns.get(key) ?? 0;
  return Math.max(0, cooldownMs - (Date.now() - last));
}
