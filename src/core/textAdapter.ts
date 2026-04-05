/**
 * TextInteractionAdapter — wraps a Discord Message to look like a ChatInputCommandInteraction.
 * Allows text prefix commands (.play, arklay ask, etc.) to reuse slash command handlers.
 */
import type { Message, TextChannel, GuildMember, User, Guild, Client } from 'discord.js';

export class MissingArgError extends Error {
  constructor(public readonly argName: string, public readonly commandName: string) {
    super(`Missing required argument: ${argName}`);
  }
}

export class TextInteractionAdapter {
  private _message: Message;
  private _args: string;
  private _reply: Message | null = null;
  private _replied = false;
  private _deferred = false;

  readonly commandName: string;
  readonly user: User;
  readonly member: GuildMember;
  readonly guild: Guild;
  readonly guildId: string;
  readonly channel: TextChannel;
  readonly client: Client;
  readonly options: TextOptionsAdapter;

  constructor(message: Message, commandName: string, args: string) {
    this._message = message;
    this._args = args;
    this.commandName = commandName;
    this.user = message.author;
    this.member = message.member as GuildMember;
    this.guild = message.guild!;
    this.guildId = message.guildId!;
    this.channel = message.channel as TextChannel;
    this.client = message.client;
    this.options = new TextOptionsAdapter(args, message, commandName);
  }

  get replied(): boolean { return this._replied; }
  get deferred(): boolean { return this._deferred; }

  async deferReply(_opts?: { ephemeral?: boolean }): Promise<void> {
    this._deferred = true;
    await this.channel.sendTyping().catch(() => undefined);
  }

  async reply(content: string | { content?: string; embeds?: unknown[]; components?: unknown[]; ephemeral?: boolean; fetchReply?: boolean }): Promise<Message> {
    this._replied = true;
    const opts = typeof content === 'string' ? { content } : content;
    // ephemeral not possible in text — just send normally
    const sent = await this.channel.send({
      content: opts.content ?? undefined,
      embeds: opts.embeds as never[] ?? [],
      components: opts.components as never[] ?? [],
    });
    this._reply = sent;
    return sent;
  }

  async editReply(content: string | { content?: string; embeds?: unknown[]; components?: unknown[] }): Promise<Message> {
    const opts = typeof content === 'string' ? { content } : content;
    if (this._reply) {
      return this._reply.edit({
        content: opts.content ?? undefined,
        embeds: opts.embeds as never[] ?? [],
        components: opts.components as never[] ?? [],
      });
    }
    // Fallback: send new message
    const sent = await this.channel.send({
      content: opts.content ?? undefined,
      embeds: opts.embeds as never[] ?? [],
      components: opts.components as never[] ?? [],
    });
    this._reply = sent;
    return sent;
  }

  async followUp(content: string | { content?: string; ephemeral?: boolean }): Promise<Message> {
    const text = typeof content === 'string' ? content : content.content ?? '';
    return this.channel.send(text);
  }

  // Used by some commands to check if interaction is from a guild
  isCommand(): boolean { return true; }
  isChatInputCommand(): boolean { return true; }
}

/**
 * Parses text args into option-like accessors.
 * Strategy: the full args string is returned for ANY getString() call.
 * For named options, we try to be smarter.
 */
class TextOptionsAdapter {
  private _raw: string;
  private _message: Message;
  private _cmdName: string;

  constructor(raw: string, message: Message, cmdName: string) {
    this._raw = raw.trim();
    this._message = message;
    this._cmdName = cmdName;
  }

  getString(name: string, required?: boolean): string | null {
    // If the last word is a small number (≤100), strip it (likely a count/option, not part of the text)
    // Numbers > 100 are kept (years like 2024, IDs, etc.)
    const parts = this._raw.split(/\s+/);
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]!)) {
      const n = parseInt(parts[parts.length - 1]!, 10);
      if (n <= 100) return parts.slice(0, -1).join(' ') || null;
    }
    const val = this._raw || null;
    if (required && !val) throw new MissingArgError(name, this._cmdName);
    return val;
  }

  getInteger(name: string, required?: boolean): number | null {
    // Try the last word if it's a small number (≤100) — large numbers like years are not options
    const parts = this._raw.split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && /^\d+$/.test(last)) {
      const n = parseInt(last, 10);
      if (n <= 100) return n;
    }
    // Fallback: try parsing the whole string (only if it's purely a number)
    if (/^\d+$/.test(this._raw)) return parseInt(this._raw, 10);
    return null;
  }

  getNumber(_name: string, _required?: boolean): number | null {
    const parts = this._raw.split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && /^\d+\.?\d*$/.test(last)) return parseFloat(last);
    const n = parseFloat(this._raw);
    return isNaN(n) ? null : n;
  }

  getBoolean(_name: string, _required?: boolean): boolean | null {
    if (!this._raw) return null;
    const lower = this._raw.toLowerCase();
    if (lower === 'true' || lower === 'on' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'off' || lower === 'no' || lower === '0') return false;
    return null;
  }

  getUser(_name: string, _required?: boolean): User | null {
    // Try to parse mention <@id> from args
    const match = this._raw.match(/<@!?(\d+)>/);
    if (match) return this._message.client.users.cache.get(match[1]!) ?? null;
    return null;
  }

  getMember(_name: string, _required?: boolean): GuildMember | null {
    const match = this._raw.match(/<@!?(\d+)>/);
    if (match) return this._message.guild?.members.cache.get(match[1]!) ?? null;
    return null;
  }

  getChannel(_name: string, _required?: boolean): unknown { return null; }
  getRole(_name: string, _required?: boolean): unknown { return null; }
  getAttachment(_name: string, _required?: boolean): unknown { return null; }
  getSubcommand(): string { return ''; }
  getSubcommandGroup(): string | null { return null; }
}
