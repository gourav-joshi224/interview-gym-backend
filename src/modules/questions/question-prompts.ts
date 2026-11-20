import { Level, LEVEL_LABEL, LEVEL_SPEC } from '../../domain/levels';
import { QuestionType, TopicDef } from '../curriculum/curriculum.data';
import { QUESTION_TYPES } from './question-validator';
import { Slot } from './slot-planner';

const TYPE_GUIDE: Record<QuestionType, string> = {
  concept: 'Ask the candidate to explain a concept, a mechanism, or why something works the way it does.',
  scenario: 'A short realistic situation (2 sentences at most). Ask what they would do or what will happen.',
  debugging: 'Describe broken behaviour or show a small snippet. Ask for the root cause and the fix.',
  design: 'Ask them to design one component or flow under stated constraints. Not a whole company-scale system unless the level is advanced.',
  tradeoff: 'Name two or three options. Ask which they would choose for a stated situation, and why.',
  coding: 'An algorithmic or small coding task. Ask for approach, complexity and edge cases. Do NOT require a full implementation; a short snippet in a fenced code block is fine.',
};

/** Defends against text from user-controlled fields (focus concepts) steering the prompt. */
export function sanitizeInline(value: string, max = 80): string {
  return value.replace(/[\r\n`"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function questionSchema(topic: TopicDef): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slot: { type: 'integer', description: 'The slot number this question answers.' },
            subtopicId: { type: 'string', enum: topic.subtopics.map((subtopic) => subtopic.id) },
            type: { type: 'string', enum: QUESTION_TYPES },
            level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            concept: { type: 'string', description: 'The specific concept tested, at most 5 words.' },
            question: { type: 'string' },
            expectedPoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  weight: { type: 'integer', description: '1 nice to mention, 2 expected, 3 essential.' },
                },
                required: ['text', 'weight'],
              },
            },
            commonMistakes: { type: 'array', items: { type: 'string' } },
          },
          required: ['slot', 'subtopicId', 'type', 'level', 'concept', 'question', 'expectedPoints', 'commonMistakes'],
        },
      },
    },
    required: ['questions'],
  };
}

export function buildGenerationPrompt(input: {
  topic: TopicDef;
  level: Level;
  slots: Slot[];
  avoid: string[];
}): { system: string; prompt: string } {
  const { topic, level, slots, avoid } = input;
  const spec = LEVEL_SPEC[level];
  const subtopicLabel = (id: string | null) =>
    topic.subtopics.find((subtopic) => subtopic.id === id)?.label ?? 'choose the best-fitting subtopic';

  const system = [
    'You are a senior engineer who runs technical interviews and writes high-quality questions for a mock-interview platform.',
    'Your questions must be precise, on-topic, correct, and calibrated to the requested level.',
    'Write only what the schema asks for. Never include the answer in the question text.',
  ].join(' ');

  const slotLines = slots
    .map((slot) => {
      const parts = [
        `slot ${slot.index}`,
        slot.subtopicId ? `subtopicId="${slot.subtopicId}" (${subtopicLabel(slot.subtopicId)})` : 'subtopicId: pick the best fit from the schema enum',
        `type="${slot.type}"`,
      ];
      if (slot.focus) parts.push(`target this weak concept: "${sanitizeInline(slot.focus)}"`);
      return `- ${parts.join(' | ')}`;
    })
    .join('\n');

  const avoidBlock =
    avoid.length > 0
      ? `\nThe candidate has already seen these questions. Do not repeat or closely paraphrase any of them:\n${avoid
          .map((text) => `- ${sanitizeInline(text, 160)}`)
          .join('\n')}\n`
      : '';

  const prompt = `
TOPIC: ${topic.label}. ${topic.description}
LEVEL: ${LEVEL_LABEL[level]}
Audience: ${spec.audience}
Scope: ${spec.scope}
Every question must follow these rules:
${spec.mustDo.map((rule) => `- ${rule}`).join('\n')}
Hard limits for every question (never violate):
${spec.mustNotDo.map((rule) => `- ${rule}`).join('\n')}

QUESTION TYPES
${QUESTION_TYPES.map((type) => `- ${type}: ${TYPE_GUIDE[type]}`).join('\n')}

Write exactly one question for each slot below, in order, using the slot's subtopic and type. If a type fits the subtopic awkwardly, still honour it in the most natural way for that subtopic. Echo the slot number, subtopicId, type and level ("${level}") in each item.
${slotLines}

RULES FOR EACH QUESTION
- Self-contained: no reference to earlier questions or to "the above".
- One main thing to answer. At most 60 words outside code blocks.
- Technically correct and unambiguous; a strong ${LEVEL_LABEL[level].toLowerCase()} candidate should be able to answer in ${spec.answerSize}.
- Put code only inside fenced blocks, and only when the topic is code-oriented and the type is coding or debugging.
- Vary the situation and wording across questions. Avoid reusing the same company, product or numbers.
- expectedPoints: 3 to 5 concrete, checkable points a good answer contains, each under 25 words. Weight 3 = essential, 2 = expected, 1 = nice to mention. They must be correct and specific to this question.
- commonMistakes: 0 to 3 typical wrong beliefs or errors candidates make on this question.
${avoidBlock}`.trim();

  return { system, prompt };
}

export const judgeSchema = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slot: { type: 'integer' },
          onTopic: { type: 'boolean', description: 'True if the question really tests the stated subtopic.' },
          levelFit: { type: 'string', enum: ['too_easy', 'ok', 'too_hard'] },
          clear: { type: 'boolean', description: 'True if the question is unambiguous, answerable, and technically correct.' },
          reason: { type: 'string', description: 'One short sentence, only needed when something is wrong.' },
        },
        required: ['slot', 'onTopic', 'levelFit', 'clear', 'reason'],
      },
    },
  },
  required: ['verdicts'],
};

export function buildJudgePrompt(input: {
  topic: TopicDef;
  level: Level;
  items: Array<{ slot: number; subtopic: string; question: string }>;
}): { system: string; prompt: string } {
  const { topic, level, items } = input;
  const spec = LEVEL_SPEC[level];
  return {
    system:
      'You are a strict reviewer of interview questions. You check topic relevance, difficulty calibration, clarity and technical correctness. Be critical but fair.',
    prompt: `
TOPIC: ${topic.label}
TARGET LEVEL: ${LEVEL_LABEL[level]}
Audience: ${spec.audience}
Scope: ${spec.scope}
This level must NOT contain: ${spec.mustNotDo.join(' ')}

Review each question. Mark levelFit "too_easy" if it is clearly below the level, "too_hard" if it clearly demands more than the level, otherwise "ok".
Mark onTopic false if it does not actually test the listed subtopic of ${topic.label}.
Mark clear false if it is ambiguous, has more than one unrelated ask, is factually wrong, or cannot be answered from the text.

QUESTIONS
${items.map((item) => `[slot ${item.slot}] subtopic: ${item.subtopic}\n${item.question}`).join('\n\n')}`.trim(),
  };
}
