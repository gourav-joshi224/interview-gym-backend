import { StoredQuestionPlanItem } from '../src/domain/session.types';
import { getTopicOrThrow } from '../src/modules/curriculum/curriculum.data';

/** Deterministic pseudo-random generator so shuffles are reproducible in tests. */
export function seeded(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const fakeConfig = (values: Record<string, unknown> = {}) => ({
  get: <T>(key: string, fallback?: T): T => (key in values ? (values[key] as T) : (fallback as T)),
});

export function rawQuestion(overrides: Record<string, unknown> = {}) {
  return {
    slot: 0,
    subtopicId: 'scope-closures',
    type: 'concept',
    level: 'beginner',
    concept: 'Closures',
    question: 'What is a closure in JavaScript and why can an inner function still read variables after the outer function returns?',
    expectedPoints: [
      { text: 'A closure keeps access to its lexical scope', weight: 3 },
      { text: 'The outer variables stay alive while referenced', weight: 2 },
    ],
    commonMistakes: ['Thinking closures copy the variables'],
    ...overrides,
  };
}

export function planItem(index: number, overrides: Partial<StoredQuestionPlanItem> = {}): StoredQuestionPlanItem {
  const topic = getTopicOrThrow('javascript');
  return {
    questionId: `javascript.scope-closures::q${index}`,
    topicId: topic.id,
    subtopicId: 'scope-closures',
    subtopic: 'Scope & closures',
    concept: `Concept ${index}`,
    type: 'concept',
    level: 'beginner',
    renderedQuestion: `Question number ${index} about closures in JavaScript?`,
    expectedPoints: [
      { text: 'Point A about lexical scope', weight: 3 },
      { text: 'Point B about memory retention', weight: 1 },
    ],
    commonMistakes: [],
    ...overrides,
  };
}

import { QuestionGeneratorService } from '../src/modules/questions/question-generator.service';
import { QuestionPoolService } from '../src/modules/questions/question-pool.service';
import { FakeStorage } from './fakes';

/** Pool service whose randomness is fixed, so "fresh generation" is decided by the test and not by chance. */
export class TestPool extends QuestionPoolService {
  constructor(storage: FakeStorage, config: ReturnType<typeof fakeConfig>, private readonly roll = 0.99) {
    super(storage as never, config as never);
  }
  protected override random(): number {
    return this.roll;
  }
}

export function makeGenerator(gemini: unknown, config: ReturnType<typeof fakeConfig>, storage = new FakeStorage(), roll = 0.99) {
  const pool = new TestPool(storage, config, roll);
  return { generator: new QuestionGeneratorService(gemini as never, config as never, pool), storage, pool };
}
