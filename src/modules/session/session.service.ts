import { ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoredQuestionPlanItem, StoredSession } from '../../domain/session.types';
import { TOPICS, TopicDef, findTopic } from '../curriculum/curriculum.data';
import { EvaluationService } from '../evaluation/evaluation.service';
import { QuestionGeneratorService } from '../questions/question-generator.service';
import { allocateQuestions } from '../resume/resume.profile';
import { StorageService } from '../storage/storage.service';
import { FinishSessionDto } from './dto/finish-session.dto';
import { ProgressSessionDto } from './dto/progress-session.dto';
import { StartSessionDto } from './dto/start-session.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuestionPayload {
  question: string;
  questionId: string;
  questionNumber: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  /** Coalesces double-clicks and retries so one session is graded (and billed) once at a time. */
  private readonly finishing = new Map<string, Promise<Record<string, unknown>>>();

  constructor(
    private readonly storage: StorageService,
    private readonly generator: QuestionGeneratorService,
    private readonly evaluation: EvaluationService,
    private readonly config: ConfigService,
  ) {}

  async start(userId: string, input: StartSessionDto) {
    const dailyCap = this.config.get<number>('limits.maxSessionsPerDay', 30);
    const todays = await this.storage.countSessionsSince(userId, new Date(Date.now() - DAY_MS), dailyCap);
    if (todays >= dailyCap) {
      throw new HttpException(
        { error: 'DAILY_LIMIT_REACHED', message: `You have reached the limit of ${dailyCap} sessions in 24 hours.` },
        429,
      );
    }

    const mode = input.mode === 'resume' ? 'resume' : 'standard';
    const { label, topicId, topicIds, questionPlan } =
      mode === 'resume' ? await this.planResume(userId, input) : await this.planStandard(userId, input);

    if (questionPlan.length === 0) {
      throw new HttpException(
        { error: 'QUESTION_GENERATION_FAILED', message: 'Could not prepare good questions right now. Please try again.' },
        503,
      );
    }

    const sessionId = await this.storage.createSession({
      userId,
      mode,
      topic: label,
      topicId,
      topicIds,
      level: input.level,
      totalQuestions: questionPlan.length,
      questionPlan,
      focus: input.focus ?? [],
    });
    this.logger.log(`session ${sessionId} started mode=${mode} topics=${topicIds.join('+')} level=${input.level} questions=${questionPlan.length}/${input.totalQuestions}`);

    return {
      sessionId,
      mode,
      topic: label,
      level: input.level,
      done: false,
      totalQuestions: questionPlan.length,
      questionNumber: 1,
      question: questionPlan[0].renderedQuestion,
      questionId: questionPlan[0].questionId,
      subtopic: questionPlan[0].subtopic,
      type: questionPlan[0].type,
    };
  }

  private async planStandard(userId: string, input: StartSessionDto) {
    const topic = findTopic(input.topic);
    if (!topic) {
      throw new HttpException({ error: 'UNSUPPORTED_TOPIC', topic: input.topic, supported: TOPICS.map((item) => item.id) }, 400);
    }
    const known = new Set(topic.subtopics.map((subtopic) => subtopic.id));
    const unknown = (input.subtopics ?? []).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new HttpException({ error: 'UNKNOWN_SUBTOPIC', subtopics: unknown }, 400);
    }

    const avoid = await this.storage.recentQuestionTexts(userId, [topic.id]);
    const questionPlan = await this.generator.generate({
      topic,
      level: input.level,
      total: input.totalQuestions,
      subtopicIds: input.subtopics,
      focus: input.focus?.map((item) => item.trim()).filter(Boolean),
      avoid,
    });
    return { label: topic.label, topicId: topic.id, topicIds: [topic.id], questionPlan };
  }

  /** The user already reviewed and confirmed these skills, so they are trusted only after id validation. */
  private async planResume(userId: string, input: StartSessionDto) {
    const skills = input.skills ?? [];
    const merged = new Map<string, { topic: TopicDef; subtopicIds: Set<string>; strength: 'core' | 'used' | 'mentioned' }>();
    for (const skill of skills) {
      const topic = findTopic(skill.topicId);
      if (!topic) {
        throw new HttpException({ error: 'UNSUPPORTED_TOPIC', topic: skill.topicId, supported: TOPICS.map((item) => item.id) }, 400);
      }
      const known = new Set(topic.subtopics.map((subtopic) => subtopic.id));
      const unknown = (skill.subtopicIds ?? []).filter((id) => !known.has(id));
      if (unknown.length > 0) throw new HttpException({ error: 'UNKNOWN_SUBTOPIC', subtopics: unknown }, 400);

      const existing = merged.get(topic.id);
      const order = ['core', 'used', 'mentioned'];
      if (existing) {
        (skill.subtopicIds ?? []).forEach((id) => existing.subtopicIds.add(id));
        if (order.indexOf(skill.strength) < order.indexOf(existing.strength)) existing.strength = skill.strength;
      } else {
        merged.set(topic.id, { topic, subtopicIds: new Set(skill.subtopicIds ?? []), strength: skill.strength });
      }
    }

    const allocation = allocateQuestions(
      [...merged.entries()].map(([topicId, value]) => ({ topicId, strength: value.strength })),
      input.totalQuestions,
    );
    const topicIds = allocation.map((item) => item.topicId);
    const avoid = await this.storage.recentQuestionTexts(userId, topicIds);
    const questionPlan: StoredQuestionPlanItem[] = await this.generator.generateMixed({
      level: input.level,
      avoid,
      groups: allocation.map((item) => {
        const entry = merged.get(item.topicId) as { topic: TopicDef; subtopicIds: Set<string> };
        return { topic: entry.topic, count: item.count, subtopicIds: [...entry.subtopicIds] };
      }),
    });
    return { label: 'Resume interview', topicId: 'resume', topicIds, questionPlan };
  }

  async progress(userId: string, input: ProgressSessionDto) {
    const session = await this.loadOwned(userId, input.sessionId);
    this.assertActive(session);

    const { questionPlan: plan, answers } = session;
    const expectedIndex = answers.length;
    const current = plan[expectedIndex];
    const previous = expectedIndex > 0 ? plan[expectedIndex - 1] : undefined;

    let nextAnswers = answers;
    if (current && current.questionId === input.questionId) {
      nextAnswers = [...answers, { questionId: current.questionId, question: current.renderedQuestion, answer: input.answer.trim() }];
    } else if (previous && previous.questionId === input.questionId) {
      // The client retried after a network error. Overwrite instead of duplicating.
      nextAnswers = [...answers.slice(0, -1), { questionId: previous.questionId, question: previous.renderedQuestion, answer: input.answer.trim() }];
    } else {
      throw new ConflictException({ error: 'OUT_OF_ORDER', message: 'That question is not the current one for this session.' });
    }

    await this.storage.saveAnswers(session.sessionId, nextAnswers);
    return { ok: true, ...this.position(session, nextAnswers.length) };
  }

  async finish(userId: string, input: FinishSessionDto): Promise<Record<string, unknown>> {
    const session = await this.loadOwned(userId, input.sessionId);
    if (session.status === 'completed' && session.report && session.questionResults) {
      return this.finishPayload(session);
    }
    this.assertActive(session);

    if (session.answers.length < session.questionPlan.length) {
      throw new ConflictException({
        error: 'INCOMPLETE_SESSION',
        message: `Answer all ${session.questionPlan.length} questions before finishing.`,
        answered: session.answers.length,
      });
    }

    const existing = this.finishing.get(session.sessionId);
    if (existing) return existing;

    const job = this.runFinish(session).finally(() => this.finishing.delete(session.sessionId));
    this.finishing.set(session.sessionId, job);
    return job;
  }

  /** Lets the client resume after a refresh without trusting anything stored in the browser. */
  async get(userId: string, sessionId: string) {
    const session = await this.loadOwned(userId, sessionId);
    const answered = session.answers.length;
    return {
      sessionId: session.sessionId,
      mode: session.mode,
      status: session.status,
      topic: session.topic,
      level: session.level,
      answeredCount: answered,
      focus: session.focus,
      ...this.position(session, answered),
    };
  }

  private async runFinish(session: StoredSession): Promise<Record<string, unknown>> {
    const { report, questionResults } = await this.evaluation.evaluate({
      topicIds: session.topicIds,
      level: session.level,
      plan: session.questionPlan,
      answers: session.answers,
    });
    await this.storage.completeSession(session.sessionId, report, questionResults);
    this.logger.log(`session ${session.sessionId} graded overall=${report.overallScore}`);
    return this.finishPayload({ ...session, status: 'completed', report, questionResults });
  }

  private finishPayload(session: StoredSession): Record<string, unknown> {
    return {
      sessionId: session.sessionId,
      mode: session.mode,
      topic: session.topic,
      topicId: session.topicId,
      topicIds: session.topicIds,
      level: session.level,
      totalQuestions: session.totalQuestions,
      answers: session.answers,
      status: 'completed',
      report: session.report,
      questionResults: session.questionResults,
    };
  }

  /** Where the candidate is: the next unanswered question, or done. */
  private position(session: StoredSession, answeredCount: number) {
    const next = session.questionPlan[answeredCount];
    return {
      done: !next,
      totalQuestions: session.totalQuestions,
      questionNumber: Math.min(answeredCount + 1, session.totalQuestions),
      ...(next ? { question: next.renderedQuestion, questionId: next.questionId, subtopic: next.subtopic, type: next.type } : {}),
    };
  }

  private async loadOwned(userId: string, sessionId: string): Promise<StoredSession> {
    const session = await this.storage.getSession(sessionId);
    // Same response for missing and foreign sessions so ids cannot be probed.
    if (!session || session.userId !== userId) {
      throw new NotFoundException({ error: 'SESSION_NOT_FOUND' });
    }
    return session;
  }

  private assertActive(session: StoredSession): void {
    if (session.status === 'completed') {
      throw new ConflictException({ error: 'SESSION_COMPLETED' });
    }
    const usable = session.questionPlan.length > 0 && session.questionPlan.every((item) => Array.isArray(item.expectedPoints));
    if (!usable) {
      throw new ConflictException({
        error: 'SESSION_OUTDATED',
        message: 'This session was created by an older version of the app. Please start a new one.',
      });
    }
  }
}
