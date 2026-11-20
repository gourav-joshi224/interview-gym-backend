import { ExpectedPoint, PointVerdict, QuestionResult, Readiness, SkillScore } from '../../domain/session.types';

const VERDICT_VALUE: Record<PointVerdict, number> = { covered: 1, partial: 0.5, missed: 0 };
const MISCONCEPTION_PENALTY = 8;
const MAX_MISCONCEPTION_PENALTY = 24;

/**
 * Score for one question, 0 to 100, from weighted point verdicts.
 * Computed here and not by the model so the same verdicts always give the same number.
 */
export function scoreQuestion(points: ExpectedPoint[], verdicts: PointVerdict[], misconceptionCount: number): number {
  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0);
  if (totalWeight === 0) return 0;
  const earned = points.reduce((sum, point, index) => sum + point.weight * VERDICT_VALUE[verdicts[index] ?? 'missed'], 0);
  const base = (earned / totalWeight) * 100;
  const penalty = base > 0 ? Math.min(MAX_MISCONCEPTION_PENALTY, misconceptionCount * MISCONCEPTION_PENALTY) : 0;
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export function overallScore(results: Array<Pick<QuestionResult, 'score'>>): number {
  if (results.length === 0) return 0;
  return Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length);
}

export function readinessFor(score: number): Readiness {
  if (score < 40) return 'not_ready';
  if (score < 60) return 'developing';
  if (score < 80) return 'interview_ready';
  return 'strong';
}

/** Average question score per subtopic, on the 0 to 10 scale the report UI already uses. */
export function skillBreakdown(results: Array<Pick<QuestionResult, 'score' | 'subtopic'>>): SkillScore[] {
  const groups = new Map<string, number[]>();
  for (const result of results) {
    groups.set(result.subtopic, [...(groups.get(result.subtopic) ?? []), result.score]);
  }
  return [...groups.entries()]
    .map(([skill, scores]) => ({
      skill,
      score: Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length / 10) * 10) / 10,
    }))
    .sort((left, right) => left.score - right.score);
}
