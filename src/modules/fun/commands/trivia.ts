import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';
import { ask } from '../../../services/ai/router';
import { logger } from '../../../services/logger';

function decodeHtml(html: string): string {
  return html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'");
}

const LABELS = ['A', 'B', 'C', 'D'];
const COLORS = [ButtonStyle.Primary, ButtonStyle.Success, ButtonStyle.Danger, ButtonStyle.Secondary];

const trivia: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Answer a random trivia question')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Trivia category')
        .setRequired(false)
        .addChoices(
          { name: 'General Knowledge', value: '9' },
          { name: 'Science',           value: '17' },
          { name: 'History',           value: '23' },
          { name: 'Geography',        value: '22' },
          { name: 'Video Games',      value: '15' },
          { name: 'Movies',           value: '11' },
          { name: 'Music',            value: '12' },
          { name: 'Sports',           value: '21' },
          { name: 'AI Generated',     value: 'ai' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const cat  = interaction.options.getString('category') ?? '';

    let question = '';
    let correct = '';
    let answers: string[] = [];
    let correctIdx = 0;
    let categoryLabel = '';
    let difficultyLabel = '';

    if (cat === 'ai') {
      // AI-generated trivia
      let aiParsed = false;
      try {
        const aiResult = await ask(
          interaction.guildId ?? 'dm',
          interaction.user.id,
          'Generate a unique, interesting multiple-choice trivia question. Respond in EXACTLY this JSON format and nothing else: {"question": "...", "correct_answer": "...", "incorrect_answers": ["...", "...", "..."]}'
        );

        // Extract JSON from the response (handle code blocks)
        let jsonText = aiResult.text.trim();
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) jsonText = codeBlockMatch[1]!.trim();

        const parsed = JSON.parse(jsonText) as {
          question?: string;
          correct_answer?: string;
          incorrect_answers?: string[];
        };

        if (
          parsed.question &&
          parsed.correct_answer &&
          Array.isArray(parsed.incorrect_answers) &&
          parsed.incorrect_answers.length === 3
        ) {
          question = parsed.question;
          correct = parsed.correct_answer;
          answers = [...parsed.incorrect_answers, correct].sort(() => Math.random() - 0.5);
          correctIdx = answers.indexOf(correct);
          categoryLabel = `AI Generated (${aiResult.provider})`;
          difficultyLabel = 'AI';
          aiParsed = true;
        }
      } catch (err) {
        logger.warn({ err }, '/trivia: AI generation failed, falling back to OpenTDB');
      }

      if (!aiParsed) {
        // Fall back to OpenTDB
        const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const json = await res.json() as {
          results: Array<{
            question: string;
            correct_answer: string;
            incorrect_answers: string[];
            category: string;
            difficulty: string;
          }>;
        };
        if (!json.results?.length) {
          await interaction.editReply('Could not fetch a trivia question. Try again.');
          return;
        }
        const q = json.results[0]!;
        question = decodeHtml(q.question);
        correct = decodeHtml(q.correct_answer);
        answers = [...q.incorrect_answers.map(decodeHtml), correct].sort(() => Math.random() - 0.5);
        correctIdx = answers.indexOf(correct);
        categoryLabel = decodeHtml(q.category);
        difficultyLabel = q.difficulty;
      }
    } else {
      const url = `https://opentdb.com/api.php?amount=1&type=multiple${cat ? `&category=${cat}` : ''}`;

      const res = await fetch(url);
      const json = await res.json() as {
        results: Array<{
          question: string;
          correct_answer: string;
          incorrect_answers: string[];
          category: string;
          difficulty: string;
        }>;
      };

      if (!json.results?.length) {
        await interaction.editReply('Could not fetch a trivia question. Try again.');
        return;
      }

      const q = json.results[0]!;
      question = decodeHtml(q.question);
      correct = decodeHtml(q.correct_answer);
      answers = [...q.incorrect_answers.map(decodeHtml), correct].sort(() => Math.random() - 0.5);
      correctIdx = answers.indexOf(correct);
      categoryLabel = decodeHtml(q.category);
      difficultyLabel = q.difficulty;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Trivia')
      .setDescription(`**${question}**\n\n${answers.map((a, i) => `**${LABELS[i]}:** ${a}`).join('\n')}`)
      .setFooter({ text: `${categoryLabel} • ${difficultyLabel} • 15 seconds` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...answers.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`trivia_${i}`)
          .setLabel(LABELS[i]!)
          .setStyle(COLORS[i]!)
      )
    );

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15_000,
      max: 1,
    });

    collector.on('collect', async (btn) => {
      const picked = parseInt(btn.customId.split('_')[1]!, 10);
      const isCorrect = picked === correctIdx;

      const resultEmbed = new EmbedBuilder()
        .setColor(isCorrect ? 0x57f287 : 0xed4245)
        .setTitle(isCorrect ? 'Correct!' : 'Wrong!')
        .setDescription(`**${question}**\n\nThe answer was: **${correct}**`)
        .setFooter({ text: `Answered by ${btn.user.username}` });

      await btn.update({ embeds: [resultEmbed], components: [] });
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x99aab5)
          .setTitle('Time\'s up!')
          .setDescription(`**${question}**\n\nThe answer was: **${correct}**`);
        await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => undefined);
      }
    });
  },
};

export default trivia;
