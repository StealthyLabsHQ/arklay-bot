import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { isBotAdmin } from '../../../services/permissions';
import {
  createTag, getTag, listTags, deleteTag, editTag, incrementUses, searchTags,
} from '../../../services/tags';
import { logger } from '../../../services/logger';

const NAME_RE = /^[a-z0-9-]{1,32}$/;
const PER_PAGE = 8;

const tags: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('tags')
    .setDescription('Custom server tags / text snippets')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new tag (admin only)')
        .addStringOption((opt) => opt.setName('name').setDescription('Tag name (a-z, 0-9, hyphens, max 32)').setRequired(true).setMaxLength(32))
        .addStringOption((opt) => opt.setName('content').setDescription('Tag content (max 2000 chars)').setRequired(true).setMaxLength(2000))
    )
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Show a tag')
        .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all tags on this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a tag (admin only)')
        .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit a tag content (admin only)')
        .addStringOption((opt) => opt.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => opt.setName('content').setDescription('New content (max 2000 chars)').setRequired(true).setMaxLength(2000))
    ) as SlashCommandBuilder,
  guildOnly: true,

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    const guildId = interaction.guildId;
    if (!guildId) { await interaction.respond([]); return; }
    const results = searchTags(guildId, focused.toLowerCase());
    await interaction.respond(results.map((r) => ({ name: r.name, value: r.name })));
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const sub     = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;
      const member  = interaction.guild!.members.cache.get(interaction.user.id)
                   ?? await interaction.guild!.members.fetch(interaction.user.id);

      // ── create ───────────────────────────────────────────────────────────
      if (sub === 'create') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to create tags.', ephemeral: true });
          return;
        }
        const name    = interaction.options.getString('name', true).toLowerCase();
        const content = interaction.options.getString('content', true);
        if (!NAME_RE.test(name)) {
          await interaction.reply({ content: 'Tag name must be 1-32 characters: letters, numbers, hyphens only.', ephemeral: true });
          return;
        }
        const ok = createTag(guildId, name, content, interaction.user.id);
        if (!ok) {
          await interaction.reply({ content: `A tag named \`${name}\` already exists.`, ephemeral: true });
          return;
        }
        await interaction.reply({ content: `✅ Tag \`${name}\` created.`, ephemeral: true });
        return;
      }

      // ── show ─────────────────────────────────────────────────────────────
      if (sub === 'show') {
        const name = interaction.options.getString('name', true).toLowerCase();
        const tag  = getTag(guildId, name);
        if (!tag) {
          await interaction.reply({ content: `No tag named \`${name}\` found.`, ephemeral: true });
          return;
        }
        incrementUses(guildId, name);
        await interaction.reply({ content: tag.content });
        return;
      }

      // ── list ─────────────────────────────────────────────────────────────
      if (sub === 'list') {
        const all = listTags(guildId);
        if (all.length === 0) {
          await interaction.reply({ content: 'No tags on this server yet. Use `/tags create` to add one.', ephemeral: true });
          return;
        }

        const totalPages = Math.ceil(all.length / PER_PAGE);
        let page = 0;

        const buildEmbed = (p: number): EmbedBuilder => {
          const slice = all.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
          const lines = slice.map((t) => `\`${t.name}\` — ${t.uses} use${t.uses !== 1 ? 's' : ''} · <@${t.author_id}>`);
          return new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🏷️ Server Tags (${all.length})`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: totalPages > 1 ? `Page ${p + 1}/${totalPages}` : `${all.length} tag${all.length !== 1 ? 's' : ''}` });
        };

        const buildRow = (p: number): ActionRowBuilder<ButtonBuilder> =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('tags_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId('tags_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
          );

        const reply = await interaction.reply({
          embeds: [buildEmbed(page)],
          components: totalPages > 1 ? [buildRow(page)] : [],
          fetchReply: true,
        });

        if (totalPages <= 1) return;

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 120_000,
        });

        collector.on('collect', async (btn) => {
          if (btn.user.id !== interaction.user.id) {
            await btn.reply({ content: 'Only the command invoker can navigate.', ephemeral: true });
            return;
          }
          if (btn.customId === 'tags_prev') page = Math.max(0, page - 1);
          if (btn.customId === 'tags_next') page = Math.min(totalPages - 1, page + 1);
          await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        });

        collector.on('end', async () => {
          await interaction.editReply({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('tags_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('tags_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
              ),
            ],
          }).catch(() => undefined);
        });
        return;
      }

      // ── delete ───────────────────────────────────────────────────────────
      if (sub === 'delete') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to delete tags.', ephemeral: true });
          return;
        }
        const name = interaction.options.getString('name', true).toLowerCase();
        const ok   = deleteTag(guildId, name);
        if (!ok) {
          await interaction.reply({ content: `No tag named \`${name}\` found.`, ephemeral: true });
          return;
        }
        await interaction.reply({ content: `🗑️ Tag \`${name}\` deleted.`, ephemeral: true });
        return;
      }

      // ── edit ─────────────────────────────────────────────────────────────
      if (sub === 'edit') {
        if (!isBotAdmin(member)) {
          await interaction.reply({ content: 'You need admin or bot-admin role to edit tags.', ephemeral: true });
          return;
        }
        const name       = interaction.options.getString('name', true).toLowerCase();
        const newContent = interaction.options.getString('content', true);
        const ok         = editTag(guildId, name, newContent);
        if (!ok) {
          await interaction.reply({ content: `No tag named \`${name}\` found.`, ephemeral: true });
          return;
        }
        await interaction.reply({ content: `✅ Tag \`${name}\` updated.`, ephemeral: true });
        return;
      }
    } catch (err) {
      logger.warn({ err }, '/tags failed');
      const msg = { content: 'Something went wrong. Try again later.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => undefined);
      else await interaction.reply(msg).catch(() => undefined);
    }
  },
};

export default tags;
