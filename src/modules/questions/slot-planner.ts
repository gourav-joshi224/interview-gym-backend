import { Level } from '../../domain/levels';
import { QuestionType, TopicDef } from '../curriculum/curriculum.data';

export interface Slot {
  index: number;
  /** Null for focus slots where the model picks the best-fitting subtopic. */
  subtopicId: string | null;
  type: QuestionType;
  /** Weak concept to target, used by "retry weak areas". */
  focus?: string;
}

export interface SlotPlanInput {
  topic: TopicDef;
  level: Level;
  total: number;
  subtopicIds?: string[];
  focus?: string[];
}

type Rng = () => number;

/** Weighted type mixes. Keys not supported by the topic (coding) are dropped at plan time. */
const TYPE_WEIGHTS: Record<Level, Partial<Record<QuestionType, number>>> = {
  beginner: { concept: 5, scenario: 2, coding: 2, debugging: 1 },
  intermediate: { concept: 2, scenario: 3, debugging: 2, tradeoff: 2, coding: 2, design: 1 },
  advanced: { design: 3, tradeoff: 3, scenario: 2, debugging: 2 },
};

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickType(weights: Array<[QuestionType, number]>, previous: QuestionType | null, rng: Rng): QuestionType {
  // Avoid the same type twice in a row when there is any alternative.
  const pool = weights.filter(([type]) => type !== previous);
  const usable = pool.length > 0 ? pool : weights;
  const total = usable.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [type, weight] of usable) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return usable[usable.length - 1][0];
}

/**
 * Decides the shape of the interview in code, so topic coverage and question mix never
 * depend on the model's mood. The model only writes the question for each slot.
 */
export function planSlots(input: SlotPlanInput, rng: Rng = Math.random): Slot[] {
  const { topic, level, total } = input;
  const known = new Set(topic.subtopics.map((subtopic) => subtopic.id));
  const chosen = (input.subtopicIds ?? []).filter((id, i, all) => known.has(id) && all.indexOf(id) === i);
  const pool = chosen.length > 0 ? chosen : topic.subtopics.map((subtopic) => subtopic.id);

  const weights = (Object.entries(TYPE_WEIGHTS[level]) as Array<[QuestionType, number]>).filter(
    ([type]) => topic.supportsCode || type !== 'coding',
  );

  const order = shuffle(pool, rng);
  const focus = (input.focus ?? []).slice(0, Math.ceil(total / 2));

  const slots: Slot[] = [];
  let previousType: QuestionType | null = null;
  for (let index = 0; index < total; index += 1) {
    const type = pickType(weights, previousType, rng);
    previousType = type;
    const focusText = focus[index];
    slots.push({
      index,
      subtopicId: focusText ? null : order[index % order.length],
      type,
      ...(focusText ? { focus: focusText } : {}),
    });
  }
  return slots;
}
