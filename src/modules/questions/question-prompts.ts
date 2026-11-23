import { Level, LEVEL_LABEL, LEVEL_SPEC } from '../../domain/levels';
import { QuestionType, TopicDef } from '../curriculum/curriculum.data';
import { QUESTION_TYPES } from './question-validator';
import { pickAnchors } from '../curriculum/anchors';
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

/** Subtopic ids are unique across topics, so one schema can serve a mixed-topic session. */
export function questionSchema(topics: TopicDef[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slot: { type: 'integer', description: 'The slot number this question answers.' },
            subtopicId: { type: 'string', enum: topics.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.id)) },
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
  topics: TopicDef[];
  level: Level;
  slots: Slot[];
  avoid: string[];
}): { system: string; prompt: string } {
  const { topics, level, slots, avoid } = input;
  const spec = LEVEL_SPEC[level];
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const subtopicLabel = (slot: Slot) =>
    topicById.get(slot.topicId)?.subtopics.find((subtopic) => subtopic.id === slot.subtopicId)?.label ??
    'choose the best-fitting subtopic';
  const multi = topics.length > 1;

  const system = [
    'You are a senior engineer who runs technical interviews and writes high-quality questions for a mock-interview platform.',
    'Your questions must be precise, on-topic, correct, and calibrated to the requested level.',
    'Write only what the schema asks for. Never include the answer in the question text.',
  ].join(' ');

  const usedAnchors = new Set<string>();
  const slotLines = slots
    .map((slot) => {
      const parts = [
        `slot ${slot.index}`,
        ...(multi ? [`topic="${topicById.get(slot.topicId)?.label ?? slot.topicId}"`] : []),
        slot.subtopicId ? `subtopicId="${slot.subtopicId}" (${subtopicLabel(slot)})` : 'subtopicId: pick the best fit from the schema enum',
        `type="${slot.type}"`,
      ];
      if (slot.focus) parts.push(`target this weak concept: "${sanitizeInline(slot.focus)}"`);
      const anchors = pickAnchors(slot.subtopicId, level, 2, Math.random, usedAnchors);
      anchors.forEach((anchor) => usedAnchors.add(anchor));
      const line = `- ${parts.join(' | ')}`;
      return anchors.length > 0 ? `${line}\n    real interview angles to build on (choose one, rephrase it, vary the scenario): ${anchors.join('; ')}` : line;
    })
    .join('\n');

  const avoidBlock =
    avoid.length > 0
      ? `\nThe candidate has already seen these questions. Do not repeat or closely paraphrase any of them:\n${avoid
          .map((text) => `- ${sanitizeInline(text, 160)}`)
          .join('\n')}\n`
      : '';

  const prompt = `
${topics.map((topic) => `TOPIC: ${topic.label}. ${topic.description}`).join('\n')}
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
- Technically correct and unambiguous; a strong ${LEVEL_LABEL[level].toLowerCase()} candidate should be able to answer in ${spec.answerSize}.${multi ? '\n- Each question tests only its own slot topic. Do not mix topics inside one question.' : ''}
- Put code only inside fenced blocks, and only when the topic is code-oriented and the type is coding or debugging. Write the fence on its own lines, with one statement per line and real line breaks inside the block.
- Depth follows the level, not the subtopic's reputation. If a subtopic is usually advanced (for example the event loop or garbage collection) and the level is beginner or intermediate, ask only about its most basic, widely known idea.
- Vary the situation and wording across questions. Avoid reusing the same company, product or numbers.
- Ground each question in a real interview angle when one is given for its slot. Interviewers keep asking these, so the candidate should recognise the territory, but use a fresh scenario and wording.
- Formatting: wrap every code identifier, variable, function, method, operator, command, header, status code and SQL expression in single backticks, for example \`count\`, \`Promise.all\`, \`GET /users\`, \`SELECT ... FOR UPDATE\`. Wrap one to three key technical terms the question is about in double asterisks, for example **closure** or **cache stampede**. Never put an answer or hint in the marked text. Do not use any other markdown (no headings, lists, links or bold elsewhere).
- expectedPoints: 3 to 5 concrete, checkable points a good answer contains, each under 25 words. Weight 3 = essential, 2 = expected, 1 = nice to mention. They must be correct and specific to this question. Use single backticks around code identifiers in points too.
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
  level: Level;
  items: Array<{ slot: number; topic: string; subtopic: string; question: string }>;
}): { system: string; prompt: string } {
  const { level, items } = input;
  const spec = LEVEL_SPEC[level];
  return {
    system:
      'You are a strict reviewer of interview questions. You check topic relevance, difficulty calibration, clarity and technical correctness. Be critical but fair.',
    prompt: `
TARGET LEVEL: ${LEVEL_LABEL[level]}
Audience: ${spec.audience}
Scope: ${spec.scope}
This level must NOT contain: ${spec.mustNotDo.join(' ')}

Judge each question as it is worded: the depth it demands and the prerequisite knowledge it assumes, not the usual reputation of its subtopic. A basic question about an advanced-sounding subtopic can fit a beginner. Mark levelFit "too_easy" if it is clearly below the level, "too_hard" if it clearly demands more than the level, otherwise "ok".
Mark onTopic false if it does not actually test the listed topic and subtopic.
Mark clear false if it is ambiguous, has more than one unrelated ask, is factually wrong, or cannot be answered from the text.

QUESTIONS
${items.map((item) => `[slot ${item.slot}] topic: ${item.topic} | subtopic: ${item.subtopic}\n${item.question}`).join('\n\n')}`.trim(),
  };
}
