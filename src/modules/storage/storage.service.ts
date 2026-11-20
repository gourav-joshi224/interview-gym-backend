import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../../common/firebase-admin';
import { isLevel, levelFromLegacyDifficulty } from '../../domain/levels';
import {
  InterviewFinalReport,
  QuestionResult,
  SessionAnswer,
  StoredQuestionPlanItem,
  StoredSession,
} from '../../domain/session.types';
import { findTopic } from '../curriculum/curriculum.data';
import { Level } from '../../domain/levels';

const SESSIONS = 'interviewSessions';
const USERS = 'users';
const SESSION_VERSION = 2;

export interface NewSession {
  userId: string;
  topic: string;
  topicId: string;
  level: Level;
  totalQuestions: number;
  questionPlan: StoredQuestionPlanItem[];
  focus: string[];
}

export interface SessionSummary {
  sessionId: string;
  topic: string;
  topicId: string;
  level: Level;
  totalQuestions: number;
  status: string;
  overallScore: number | null;
  readiness: string | null;
  createdAt: string | null;
}

type Doc = Record<string, unknown>;

const toIso = (value: unknown): string | null => {
  const date = (value as { toDate?: () => Date } | null)?.toDate?.();
  return date ? date.toISOString() : null;
};

/** Firestore rejects undefined; this drops it from plain data without touching anything else. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class StorageService {
  private get db() {
    return getAdminFirestore();
  }

  async createSession(input: NewSession): Promise<string> {
    const sessionId = randomUUID();
    await this.db
      .collection(SESSIONS)
      .doc(sessionId)
      .create(
        clean({
          userId: input.userId,
          topic: input.topic,
          topicId: input.topicId,
          level: input.level,
          totalQuestions: input.totalQuestions,
          questionPlan: input.questionPlan,
          focus: input.focus,
          answers: [],
          status: 'in_progress',
          report: null,
          questionResults: null,
          sessionVersion: SESSION_VERSION,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
    return sessionId;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const snapshot = await this.db.collection(SESSIONS).doc(sessionId).get();
    if (!snapshot.exists) return null;
    return this.toSession(snapshot.id, snapshot.data() as Doc);
  }

  async saveAnswers(sessionId: string, answers: SessionAnswer[]): Promise<void> {
    await this.db
      .collection(SESSIONS)
      .doc(sessionId)
      .update({ answers: clean(answers), updatedAt: FieldValue.serverTimestamp() });
  }

  async completeSession(sessionId: string, report: InterviewFinalReport, questionResults: QuestionResult[]): Promise<void> {
    await this.db
      .collection(SESSIONS)
      .doc(sessionId)
      .update({
        status: 'completed',
        report: clean(report),
        questionResults: clean(questionResults),
        updatedAt: FieldValue.serverTimestamp(),
        finishedAt: FieldValue.serverTimestamp(),
      });
  }

  async listSessionSummaries(userId: string, limit: number): Promise<SessionSummary[]> {
    const snapshot = await this.db
      .collection(SESSIONS)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .select('topic', 'topicId', 'level', 'difficulty', 'totalQuestions', 'status', 'report', 'createdAt')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Doc;
      const report = (data.report ?? null) as { overallScore?: number; readiness?: string } | null;
      const topic = String(data.topic ?? '');
      return {
        sessionId: doc.id,
        topic,
        topicId: String(data.topicId ?? findTopic(topic)?.id ?? ''),
        level: isLevel(data.level) ? data.level : levelFromLegacyDifficulty(data.difficulty as string | undefined),
        totalQuestions: Number(data.totalQuestions ?? 0),
        status: data.status === 'completed' ? 'completed' : 'in_progress',
        overallScore: typeof report?.overallScore === 'number' ? report.overallScore : null,
        readiness: report?.readiness ?? null,
        createdAt: toIso(data.createdAt),
      };
    });
  }

  /** Questions this user was recently asked on a topic, so new sessions do not repeat them. */
  async recentQuestionTexts(userId: string, topicId: string, sessionLimit = 12): Promise<string[]> {
    const snapshot = await this.db
      .collection(SESSIONS)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(sessionLimit)
      .select('topic', 'topicId', 'questionPlan')
      .get();

    const texts: string[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as Doc;
      const docTopicId = String(data.topicId ?? findTopic(String(data.topic ?? ''))?.id ?? '');
      if (docTopicId !== topicId || !Array.isArray(data.questionPlan)) continue;
      for (const item of data.questionPlan as Array<{ renderedQuestion?: unknown }>) {
        if (typeof item?.renderedQuestion === 'string') texts.push(item.renderedQuestion);
      }
    }
    return texts;
  }

  /** Counts sessions created since a point in time, stopping at `cap` since only the threshold matters. */
  async countSessionsSince(userId: string, since: Date, cap: number): Promise<number> {
    const snapshot = await this.db
      .collection(SESSIONS)
      .where('userId', '==', userId)
      .where('createdAt', '>=', since)
      .select()
      .limit(cap)
      .get();
    return snapshot.size;
  }

  async upsertUser(uid: string, name: string, email: string): Promise<void> {
    await this.db
      .collection(USERS)
      .doc(uid)
      .set({ uid, name, email, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  private toSession(sessionId: string, data: Doc): StoredSession {
    const topic = String(data.topic ?? '');
    return {
      sessionId,
      userId: typeof data.userId === 'string' ? data.userId : null,
      topic,
      topicId: String(data.topicId ?? findTopic(topic)?.id ?? ''),
      level: isLevel(data.level) ? data.level : levelFromLegacyDifficulty(data.difficulty as string | undefined),
      totalQuestions: Number(data.totalQuestions ?? 0),
      status: data.status === 'completed' ? 'completed' : 'in_progress',
      answers: Array.isArray(data.answers) ? (data.answers as SessionAnswer[]) : [],
      questionPlan: Array.isArray(data.questionPlan) ? (data.questionPlan as StoredQuestionPlanItem[]) : [],
      report: (data.report ?? null) as InterviewFinalReport | null,
      questionResults: Array.isArray(data.questionResults) ? (data.questionResults as QuestionResult[]) : null,
      focus: Array.isArray(data.focus) ? (data.focus as string[]) : [],
      createdAt: toIso(data.createdAt),
      finishedAt: toIso(data.finishedAt),
    };
  }
}
