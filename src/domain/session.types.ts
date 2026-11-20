import { Level } from './levels';
import { QuestionType } from '../modules/curriculum/curriculum.data';

export interface ExpectedPoint {
  text: string;
  /** 1 = nice to mention, 2 = expected, 3 = essential. */
  weight: number;
}

/** One planned question, stored with the session so grading uses exactly what was asked. */
export interface StoredQuestionPlanItem {
  questionId: string;
  topicId: string;
  subtopicId: string;
  subtopic: string;
  concept: string;
  type: QuestionType;
  level: Level;
  renderedQuestion: string;
  expectedPoints: ExpectedPoint[];
  commonMistakes: string[];
}

export interface SessionAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export type PointVerdict = 'covered' | 'partial' | 'missed';

export interface PointResult {
  point: string;
  verdict: PointVerdict;
}

export interface QuestionResult {
  questionId: string;
  topicId: string;
  score: number;
  concept: string;
  subtopic: string;
  attempt: 'attempted' | 'skipped';
  points: PointResult[];
  strengths: string[];
  misconceptions: string[];
  idealAnswer: string;
  feedback: { explanationForUser: string; missingConcepts: string[] };
  /** Kept for the existing report UI: the expected points the answer did not cover. */
  missedCheckpoints: string[];
}

export type Readiness = 'not_ready' | 'developing' | 'interview_ready' | 'strong';

export interface SkillScore {
  skill: string;
  /** 0 to 10. */
  score: number;
}

export interface LearningResource {
  title: string;
  url: string;
}

export interface InterviewFinalReport {
  /** 0 to 100. */
  overallScore: number;
  readiness: Readiness;
  strengths: string[];
  weakAreas: string[];
  communicationFeedback: string;
  technicalFeedback: string;
  improvementPlan: string;
  skillBreakdown: SkillScore[];
  learningResources: LearningResource[];
}

export type SessionStatus = 'in_progress' | 'completed';

export type SessionMode = 'standard' | 'resume';

export interface StoredSession {
  sessionId: string;
  userId: string | null;
  mode: SessionMode;
  topic: string;
  /** For resume sessions this is "resume"; the real topics are in topicIds. */
  topicId: string;
  topicIds: string[];
  level: Level;
  totalQuestions: number;
  status: SessionStatus;
  answers: SessionAnswer[];
  questionPlan: StoredQuestionPlanItem[];
  report: InterviewFinalReport | null;
  questionResults: QuestionResult[] | null;
  focus: string[];
  createdAt: string | null;
  finishedAt: string | null;
}
