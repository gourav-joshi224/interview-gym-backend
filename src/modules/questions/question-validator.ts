import { Level } from '../../domain/levels';
import { ExpectedPoint } from '../../domain/session.types';
import { QuestionType } from '../curriculum/curriculum.data';
import { Slot } from './slot-planner';

export interface RawQuestion {
  slot?: unknown;
  subtopicId?: unknown;
  type?: unknown;
  level?: unknown;
  concept?: unknown;
  question?: unknown;
  expectedPoints?: unknown;
  commonMistakes?: unknown;
}

export interface CleanQuestion {
  slot: number;
  subtopicId: string;
  type: QuestionType;
  level: Level;
  concept: string;
  question: string;
  expectedPoints: ExpectedPoint[];
  commonMistakes: string[];
}

export interface ValidationContext {
  level: Level;
  allowedSubtopicIds: Set<string>;
  /** Normalised texts already seen by this user or already accepted in this session. */
  knownTexts: string[];
}

export const QUESTION_TYPES: QuestionType[] = ['concept', 'scenario', 'debugging', 'design', 'tradeoff', 'coding'];

const MAX_PROSE_WORDS = 90;
const MIN_PROSE_WORDS = 5;
const MAX_QUESTION_CHARS = 1800;
const DUPLICATE_SIMILARITY = 0.6;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'you', 'your', 'with', 'that', 'this', 'what', 'how', 'why', 'when', 'would',
  'does', 'did', 'can', 'will', 'which', 'from', 'into', 'than', 'then', 'there', 'their', 'about', 'between',
  'explain', 'describe', 'happens', 'happen', 'should', 'could', 'have', 'has', 'use', 'used', 'using',
]);

const SCALE_PATTERN =
  /\b\d[\d,.]*\s*(?:k|m|million|billion|thousand)?\s*(?:rps|qps|tps|req\/s|requests?\s*(?:per|a|\/)\s*(?:second|sec|s)|concurrent users|daily active users|dau)\b/i;
const INCIDENT_PATTERN = /\b(outage|incident|on-?call|postmortem|p99|p95|sev-?\d|multi-region|petabytes?)\b/i;
const DEFINITION_OPENER = /^\s*(what\s+(is|are)|define)\b/i;

/**
 * Models sometimes put a whole snippet on one line. Put fences on their own lines and, when the body has no
 * line breaks at all, break it after statement-ending semicolons so it reads as code.
 */
export function normalizeCodeFences(text: string): string {
  return text.replace(/```([a-zA-Z0-9+#-]*)[ \t]*\n?([\s\S]*?)```/g, (_match, lang: string, body: string) => {
    let code = body.replace(/^\s+|\s+$/g, '');
    if (!code.includes('\n')) code = code.replace(/;[ \t]+(?=\S)/g, ';\n');
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  });
}

/**
 * Keeps inline markup (`code` and **term**) only when it is well formed. A stray marker would otherwise show up
 * on screen as literal characters or swallow the rest of the sentence, so unbalanced markers are removed.
 * Fenced code blocks are left untouched.
 */
export function sanitizeMarkup(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((segment) => {
      if (segment.startsWith('```')) return segment;
      let prose = segment.replace(/^#{1,6}\s+/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
      if ((prose.match(/`/g) ?? []).length % 2 === 1) prose = prose.replace(/`/g, '');
      if ((prose.match(/\*\*/g) ?? []).length % 2 === 1) prose = prose.replace(/\*\*/g, '');
      // Empty markers and a term nested inside code (`**x**`) carry no meaning.
      return prose.replace(/``/g, '').replace(/\*\*\s*\*\*/g, '').replace(/`([^`]*)`/g, (_m, inner: string) => `\`${inner.replace(/\*\*/g, '')}\``);
    })
    .join('');
}

export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, ' ');
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

export function similarity(a: string, b: string): number {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function cleanPoints(value: unknown): ExpectedPoint[] {
  if (!Array.isArray(value)) return [];
  const points: ExpectedPoint[] = [];
  for (const item of value) {
    const text = asString((item as { text?: unknown })?.text);
    if (text.length < 5 || text.length > 300) continue;
    const rawWeight = Number((item as { weight?: unknown })?.weight);
    const weight = Number.isFinite(rawWeight) ? Math.min(3, Math.max(1, Math.round(rawWeight))) : 2;
    points.push({ text, weight });
  }
  return points;
}

/**
 * Programmatic quality gate. Returns the cleaned question, or the list of reasons it was rejected.
 * Cheap and deterministic: the LLM judge runs afterwards for the things regex cannot see.
 */
export function validateCandidate(
  raw: RawQuestion,
  slot: Slot,
  context: ValidationContext,
): { ok: true; question: CleanQuestion } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];

  const question = sanitizeMarkup(normalizeCodeFences(asString(raw.question))).trim();
  const subtopicId = asString(raw.subtopicId);
  const type = asString(raw.type) as QuestionType;
  const level = asString(raw.level);
  const concept = asString(raw.concept);
  const expectedPoints = cleanPoints(raw.expectedPoints);
  const commonMistakes = Array.isArray(raw.commonMistakes)
    ? (raw.commonMistakes as unknown[]).map(asString).filter((item) => item.length >= 5).slice(0, 5)
    : [];

  if (!question) reasons.push('empty-question');
  if (question.length > MAX_QUESTION_CHARS) reasons.push('too-long');
  if (!context.allowedSubtopicIds.has(subtopicId)) reasons.push('unknown-subtopic');
  if (slot.subtopicId && subtopicId !== slot.subtopicId) reasons.push('subtopic-mismatch');
  if (!QUESTION_TYPES.includes(type)) reasons.push('unknown-type');
  if (level !== context.level) reasons.push('level-mismatch');
  if (!concept) reasons.push('missing-concept');
  if (expectedPoints.length < 2 || expectedPoints.length > 7) reasons.push('bad-expected-points');

  if (question) {
    // Markers are not words, and a bold term must not count towards the sentence limits twice.
    const prose = stripCode(question).replace(/\*\*/g, '').replace(/`/g, '');
    const words = countWords(prose);
    if (words > MAX_PROSE_WORDS) reasons.push('too-wordy');
    if (words < MIN_PROSE_WORDS) reasons.push('too-short');
    if ((prose.match(/\?/g) ?? []).length > 2) reasons.push('multi-ask');

    if (context.level === 'beginner' && (SCALE_PATTERN.test(prose) || INCIDENT_PATTERN.test(prose))) {
      reasons.push('beginner-scale-or-incident');
    }
    if (context.level !== 'beginner' && DEFINITION_OPENER.test(prose) && words <= 12) {
      reasons.push('definition-only');
    }
    if (context.knownTexts.some((known) => similarity(known, question) >= DUPLICATE_SIMILARITY)) {
      reasons.push('duplicate');
    }
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    question: {
      slot: slot.index,
      subtopicId,
      type,
      level: context.level,
      concept,
      question,
      expectedPoints,
      commonMistakes,
    },
  };
}
