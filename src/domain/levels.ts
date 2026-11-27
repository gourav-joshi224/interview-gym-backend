export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export interface LevelSpec {
  audience: string;
  scope: string;
  mustDo: string[];
  mustNotDo: string[];
  answerSize: string;
}

/**
 * Plain-language contract for each level. These strings go straight into the
 * generation and judging prompts, so wording here directly controls difficulty.
 */
export const LEVEL_SPEC: Record<Level, LevelSpec> = {
  beginner: {
    audience: 'A learner or junior engineer with under one year of hands-on experience.',
    scope: 'Fundamentals only. One core concept per question.',
    mustDo: [
      'Ask "what is / why / how does X work" or "what happens in this tiny example".',
      'Use short, concrete, self-contained wording.',
      'Be answerable in 3 to 6 sentences.',
    ],
    mustNotDo: [
      'No production incidents, outages or on-call scenarios.',
      'No scale numbers (requests per second, millions of users, terabytes).',
      'No multi-system trade-off analysis or vendor-specific tuning.',
      'No open-ended "design a system" prompts.',
    ],
    answerSize: 'a few sentences',
  },
  intermediate: {
    audience: 'An engineer with roughly one to four years of experience.',
    scope: 'Apply concepts to realistic situations.',
    mustDo: [
      'Ask the candidate to compare two approaches, debug a small realistic case, or choose between options given one or two constraints.',
      'Expect reasoning about why, not only what.',
      'Be answerable in one or two short paragraphs.',
    ],
    mustNotDo: [
      'No pure definition questions ("What is X?").',
      'No planet-scale or multi-region design problems.',
    ],
    answerSize: 'one or two short paragraphs',
  },
  advanced: {
    audience: 'A senior engineer or someone targeting a senior role.',
    scope: 'Open-ended depth: trade-offs, failure modes, scale, operations.',
    mustDo: [
      'Present a realistic constraint set (load, consistency, cost, failure) and ask for a justified approach.',
      'Expect the candidate to name trade-offs, edge cases and how they would verify the result.',
    ],
    mustNotDo: [
      'No textbook definition questions.',
      'No trivia that a quick search answers.',
    ],
    answerSize: 'a structured multi-paragraph answer',
  },
};

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/** Maps sessions created before levels existed (Warm Up / Medium / Hard / Epic) onto the new scale. */
export function levelFromLegacyDifficulty(value?: string | null): Level {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'warm up' || normalized === 'warm_up' || normalized === 'easy') return 'beginner';
  if (normalized === 'hard' || normalized === 'epic' || normalized === 'incident mode') return 'advanced';
  return 'intermediate';
}
