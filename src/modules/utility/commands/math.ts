import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

// Safe recursive descent math parser - no eval/Function()
function safeMathEval(expr: string): number | null {
  const sanitized = expr.replace(/\s/g, '');
  if (!/^[\d+\-*/().%^]+$/.test(sanitized)) return null;
  try {
    return evaluate(sanitized);
  } catch {
    return null;
  }
}

function evaluate(expr: string): number {
  let pos = 0;
  const peek = () => expr[pos];
  const next = () => expr[pos++];

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') left /= right;
      else left %= right;
    }
    return left;
  }

  function parsePower(): number {
    let base = parseUnary();
    while (peek() === '^') { next(); base = base ** parseUnary(); }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '-') { next(); return -parseAtom(); }
    if (peek() === '+') { next(); return parseAtom(); }
    return parseAtom();
  }

  function parseAtom(): number {
    if (peek() === '(') {
      next();
      const val = parseExpr();
      if (peek() === ')') next();
      return val;
    }
    let num = '';
    while (pos < expr.length && /[\d.]/.test(expr[pos]!)) num += next();
    if (!num) throw new Error('Unexpected token');
    return parseFloat(num);
  }

  const result = parseExpr();
  if (pos < expr.length) throw new Error('Unexpected token');
  if (!isFinite(result)) throw new Error('Not finite');
  return result;
}

const math: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('math')
    .setDescription('Evaluate a math expression')
    .addStringOption((opt) => opt.setName('expression').setDescription('e.g. 2+2, 5*3, (10+5)/3').setRequired(true)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const expr   = interaction.options.getString('expression', true);
    const result = safeMathEval(expr);

    if (result === null) {
      await interaction.reply({ content: 'Invalid expression. Use numbers and `+ - * / ^ ( ) %`.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .addFields(
        { name: 'Expression', value: `\`${expr}\``, inline: true },
        { name: 'Result',     value: `**${result}**`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default math;
