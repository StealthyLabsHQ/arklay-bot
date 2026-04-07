import type { SlashCommandBuilder, ContextMenuCommandBuilder, ChatInputCommandInteraction, MessageContextMenuCommandInteraction, AutocompleteInteraction, Client } from 'discord.js';

export type { LoopMode } from './modules/music/structures/GuildQueue';

export interface CommandDef {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ContextMenuDef {
  data: ContextMenuCommandBuilder;
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export interface BotModule {
  name: string;
  enabled: boolean;
  commands: CommandDef[];
  contextMenus?: ContextMenuDef[];
  onLoad?: (client: Client) => Promise<void>;
  onUnload?: () => Promise<void>;
}
