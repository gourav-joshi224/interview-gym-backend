import { createHash } from 'crypto';
import { Level } from '../../domain/levels';
import { ExpectedPoint } from '../../domain/session.types';
import { QuestionType } from '../curriculum/curriculum.data';

/**
 * A question that passed code checks and the reviewer, kept so later sessions can reuse it instead of paying
 * for a fresh generation. Contains no user data: questions built from a user's own text are never pooled.
 */
export interface PooledQuestion {
  /** Stable id derived from the content, so the same question is never stored twice. */
  id: string;
  topicId: string;
  subtopicId: string;
  level: Level;
  type: QuestionType;
  concept: string;
  question: string;
  expectedPoints: ExpectedPoint[];
  commonMistakes: string[];
  /** Bumped when prompts or anchors change enough that old questions should retire. */
  promptVersion: number;
  /** How many sessions have been served this question. Used to rotate through the pool evenly. */
  uses: number;
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function poolId(subtopicId: string, level: Level, question: string): string {
  return createHash('sha1').update(`${subtopicId}|${level}|${normalize(question)}`).digest('hex').slice(0, 24);
}
