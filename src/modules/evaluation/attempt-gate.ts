export type AttemptAssessment = { attempted: true } | { attempted: false; reason: string };

const NON_ATTEMPT_PHRASES = [
  'i dont know',
  'dont know',
  'do not know',
  'no idea',
  'idk',
  'skip',
  'skipped',
  'pass',
  'not sure',
  'no clue',
  'i have no clue',
  'cannot answer',
  'i cannot answer',
  'i cant answer',
];

const MIN_WORDS = 4;
// Real words and technical terms of four or more letters almost always contain a vowel (or y).
// Keyboard mash such as "qwrtp zxcvb" does not. Three-letter acronyms (SQL, TCP) are exempt by length.
const isVowelless = (token: string) => token.length >= 4 && !/[aeiouy0-9]/.test(token);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cheap local check run before any model call. Empty, "I don't know" and noise answers score
 * zero without spending tokens, and cannot be rescued by a generous grader.
 */
export function assessAttempt(answer: string): AttemptAssessment {
  const normalized = normalize(answer);
  if (!normalized) return { attempted: false, reason: 'No answer was provided.' };

  const tokens = normalized.split(' ');

  // A phrase only counts as a refusal when it is (nearly) the whole answer. "pass by reference" is a real answer.
  if (tokens.length <= 6 && NON_ATTEMPT_PHRASES.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `) || normalized.endsWith(` ${phrase}`))) {
    return { attempted: false, reason: 'You skipped this question or said you did not know.' };
  }

  if (tokens.length < MIN_WORDS) {
    return { attempted: false, reason: 'The answer was too short to assess.' };
  }

  if (tokens.length >= 6) {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    if (Math.max(...counts.values()) / tokens.length > 0.5) {
      return { attempted: false, reason: 'The answer repeats the same word instead of explaining.' };
    }
    const mash = tokens.filter(isVowelless).length;
    if (mash / tokens.length > 0.5) {
      return { attempted: false, reason: 'The answer does not look like a real explanation.' };
    }
  }

  return { attempted: true };
}
