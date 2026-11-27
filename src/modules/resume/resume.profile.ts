import { Level } from '../../domain/levels';
import { TOPICS, findTopic } from '../curriculum/curriculum.data';

export type SkillStrength = 'core' | 'used' | 'mentioned';

export interface ResumeSkill {
  topicId: string;
  topic: string;
  subtopicIds: string[];
  /** Short, contact-free paraphrase of what the resume shows. */
  evidence: string;
  strength: SkillStrength;
}

export interface ResumeProfile {
  roleSummary: string;
  yearsExperience: number | null;
  suggestedLevel: Level;
  skills: ResumeSkill[];
  /** Technologies found that the app cannot question on yet. Shown to the user, never silently dropped. */
  unmapped: string[];
}

export interface RawResumeAnalysis {
  isResume?: unknown;
  roleSummary?: unknown;
  yearsExperience?: unknown;
  skills?: unknown;
  unmapped?: unknown;
}

const MAX_SKILLS = 9;
const MAX_UNMAPPED = 12;
const STRENGTHS: SkillStrength[] = ['core', 'used', 'mentioned'];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github)\.com\S*/gi;
// Nine or more digits with up to two separator characters between them: covers "+1 (415) 555-0199" and "+44 20 7946 0958".
const PHONE = /(?:\+?\d[\s().-]{0,2}){9,}/g;

/** Removes contact details and control characters, then clamps length. Applied to every free-text field. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(EMAIL, ' ')
    .replace(URL, ' ')
    .replace(PHONE, ' ')
    .replace(/[\u0000-\u001f\u007f`"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Level comes from years of experience when known. The model's opinion is not used. */
export function suggestLevel(years: number | null): Level {
  if (years === null) return 'intermediate';
  if (years < 2) return 'beginner';
  if (years < 5) return 'intermediate';
  return 'advanced';
}

export function sanitizeResumeAnalysis(raw: RawResumeAnalysis): ResumeProfile {
  const rawYears = Number(raw.yearsExperience);
  const years =
    raw.yearsExperience === null || raw.yearsExperience === undefined || !Number.isFinite(rawYears)
      ? null
      : Math.min(50, Math.max(0, Math.round(rawYears * 10) / 10));

  const byTopic = new Map<string, ResumeSkill>();
  for (const item of Array.isArray(raw.skills) ? (raw.skills as Array<Record<string, unknown>>) : []) {
    const topic = findTopic(typeof item?.topicId === 'string' ? item.topicId : '');
    if (!topic) continue; // Anything off the curriculum is dropped, whatever the model claims.

    const known = new Set(topic.subtopics.map((subtopic) => subtopic.id));
    const subtopicIds = (Array.isArray(item.subtopicIds) ? (item.subtopicIds as unknown[]) : [])
      .filter((id): id is string => typeof id === 'string' && known.has(id))
      .filter((id, index, all) => all.indexOf(id) === index);
    const strength = STRENGTHS.includes(item.strength as SkillStrength) ? (item.strength as SkillStrength) : 'mentioned';
    const candidate: ResumeSkill = {
      topicId: topic.id,
      topic: topic.label,
      subtopicIds,
      evidence: cleanText(item.evidence, 160),
      strength,
    };

    const existing = byTopic.get(topic.id);
    if (!existing) {
      byTopic.set(topic.id, candidate);
    } else {
      // The model listed the topic twice: merge instead of showing duplicates.
      existing.subtopicIds = [...new Set([...existing.subtopicIds, ...candidate.subtopicIds])];
      existing.evidence = existing.evidence || candidate.evidence;
      if (STRENGTHS.indexOf(candidate.strength) < STRENGTHS.indexOf(existing.strength)) existing.strength = candidate.strength;
    }
  }

  const knownLabels = new Set(TOPICS.map((topic) => topic.label.toLowerCase()));
  const unmapped = (Array.isArray(raw.unmapped) ? (raw.unmapped as unknown[]) : [])
    .map((item) => cleanText(item, 40))
    .filter((item, index, all) => item && !knownLabels.has(item.toLowerCase()) && all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, MAX_UNMAPPED);

  const skills = [...byTopic.values()]
    .sort((left, right) => STRENGTHS.indexOf(left.strength) - STRENGTHS.indexOf(right.strength))
    .slice(0, MAX_SKILLS);

  return {
    roleSummary: cleanText(raw.roleSummary, 140),
    yearsExperience: years,
    suggestedLevel: suggestLevel(years),
    skills,
    unmapped,
  };
}

const WEIGHT: Record<SkillStrength, number> = { core: 3, used: 2, mentioned: 1 };

export interface Allocation {
  topicId: string;
  count: number;
}

/**
 * Splits `total` questions across the chosen topics, weighted by how central each skill is.
 * Every kept topic gets at least one question. When there are more topics than questions, the strongest win.
 */
export function allocateQuestions(items: Array<{ topicId: string; strength: SkillStrength }>, total: number): Allocation[] {
  const ranked = [...items].sort((left, right) => WEIGHT[right.strength] - WEIGHT[left.strength]).slice(0, total);
  if (ranked.length === 0) return [];

  const counts = new Map(ranked.map((item) => [item.topicId, 1]));
  let remaining = total - ranked.length;
  const weightSum = ranked.reduce((sum, item) => sum + WEIGHT[item.strength], 0);

  // Largest-remainder method on the leftover questions, so weights decide who gets extras.
  const shares = ranked.map((item) => ({ topicId: item.topicId, exact: (remaining * WEIGHT[item.strength]) / weightSum }));
  for (const share of shares) {
    const whole = Math.floor(share.exact);
    counts.set(share.topicId, (counts.get(share.topicId) ?? 0) + whole);
    remaining -= whole;
  }
  const byRemainder = [...shares].sort((left, right) => (right.exact % 1) - (left.exact % 1));
  for (let i = 0; remaining > 0; i = (i + 1) % byRemainder.length, remaining -= 1) {
    const topicId = byRemainder[i].topicId;
    counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
  }
  return ranked.map((item) => ({ topicId: item.topicId, count: counts.get(item.topicId) ?? 0 }));
}

/** Takes questions from each group in turn so the session alternates topics instead of clustering them. */
export function interleave<T>(groups: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i += 1) {
    for (const group of groups) if (i < group.length) result.push(group[i]);
  }
  return result;
}
