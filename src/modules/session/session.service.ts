import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StorageService, StoredQuestionPlanItem } from '../storage/storage.service';
import { QuestionAssemblyService } from '../interview-brain';
import { TOPIC_DISPLAY_MAP, toTopicId } from '../interview-brain/domain/topic-routing.util';
import { SessionEvaluationService } from './session-evaluation.service';
import { FinishSessionDto } from './dto/finish-session.dto';
import { ProgressSessionDto } from './dto/progress-session.dto';
import { StartSessionDto } from './dto/start-session.dto';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly sessionEvaluationService: SessionEvaluationService,
    private readonly questionAssembly: QuestionAssemblyService,
  ) {}

  async start(
    input: StartSessionDto & { authenticatedUserId: string },
  ): Promise<{ sessionId: string; question: string; questionId: string }> {
    this.logger.log(
      `start requested topic="${input.topic}" experience="${input.experience}" difficulty="${input.difficulty}" totalQuestions=${input.totalQuestions} authenticatedUserId="${input.authenticatedUserId}" bodyUserId="${input.userId ?? 'n/a'}" recentQuestionIds=${input.recentQuestionIds?.length ?? 0}`,
    );

    const { questionPlan, deficit } = await this.buildPlan(input, input.authenticatedUserId);
    const firstQuestion = questionPlan[0];

    if (!firstQuestion) {
      throw new HttpException({ error: 'SESSION_PLAN_MISSING' }, 500);
    }

    let sessionId: string;
    try {
      sessionId = await this.storageService.createInterviewSession({
        topic: input.topic,
        experience: input.experience,
        difficulty: input.difficulty,
        totalQuestions: input.totalQuestions,
        questionDeficit: deficit,
        answers: [],
        questionPlan,
        status: 'in_progress',
        report: null,
        userId: input.authenticatedUserId,
      });
      this.logger.log(
        `start created sessionId="${sessionId}" authenticatedUserId="${input.authenticatedUserId}" planSize=${questionPlan.length} deficit=${deficit}`,
      );
    } catch (error) {
      this.logger.error(
        `start failed authenticatedUserId="${input.authenticatedUserId}" topic="${input.topic}" error="${error instanceof Error ? error.message : String(error)}"`,
      );
      throw new InternalServerErrorException({
        error: 'SESSION_CREATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      sessionId,
      question: firstQuestion.renderedQuestion,
      questionId: firstQuestion.questionId,
    };
  }

  async progress(
    input: ProgressSessionDto & { authenticatedUserId: string },
  ): Promise<{ ok: boolean; question?: string; questionId?: string }> {
    this.logger.log(
      `progress requested sessionId="${input.sessionId}" authenticatedUserId="${input.authenticatedUserId}" answers=${input.answers.length}`,
    );
    const existing = await this.storageService.getInterviewSession(input.sessionId);

    if (!existing) {
      throw new NotFoundException('Interview session not found.');
    }

    const sessionUserId = typeof existing.userId === 'string' ? existing.userId : null;
    if (sessionUserId && sessionUserId !== input.authenticatedUserId) {
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
    }

    const questionPlan = this.extractStoredPlan(input.sessionId, existing);
    const alignedAnswers = this.bindAnswersToPlan(input.sessionId, questionPlan, input.answers, {
      validateQuestionText: false,
    });

    await this.storageService.updateInterviewSession(input.sessionId, {
      answers: alignedAnswers,
      status: 'in_progress',
    });

    this.logger.log(
      `progress updated sessionId="${input.sessionId}" storedUserId="${sessionUserId ?? 'null'}" alignedAnswers=${alignedAnswers.length}`,
    );

    const nextQuestion = questionPlan[input.answers.length];

    return {
      ok: true,
      question: nextQuestion?.renderedQuestion,
      questionId: nextQuestion?.questionId,
    };
  }

  async finish(input: FinishSessionDto & { authenticatedUserId: string }): Promise<Record<string, unknown>> {
    this.logger.log(
      `finish requested sessionId="${input.sessionId}" authenticatedUserId="${input.authenticatedUserId}" answers=${input.answers.length}`,
    );
    const session = await this.storageService.getInterviewSession(input.sessionId);

    if (!session) {
      throw new NotFoundException('Interview session not found.');
    }

    const sessionUserId = typeof session.userId === 'string' ? session.userId : null;
    if (sessionUserId && sessionUserId !== input.authenticatedUserId) {
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
    }

    const topic = String(session.topic ?? 'System Design');
    const experience = String(session.experience ?? 'mid-level');
    const difficulty = String(session.difficulty ?? 'medium');
    const totalQuestions = Number(session.totalQuestions ?? 5);
    const userId = sessionUserId;
    const questionPlan = this.extractStoredPlan(input.sessionId, session);
    const alignedAnswers = this.bindAnswersToPlan(input.sessionId, questionPlan, input.answers, {
      validateQuestionText: true,
    });

    const evaluation = this.sessionEvaluationService.evaluate({
      sessionId: input.sessionId,
      topic,
      experience,
      difficulty,
      totalQuestions,
      answers: alignedAnswers,
      questionPlan,
    });

    try {
      await this.storageService.updateInterviewSession(input.sessionId, {
        topic,
        experience,
        difficulty,
        totalQuestions,
        answers: alignedAnswers,
        questionPlan,
        status: 'completed',
        report: evaluation.report,
      }, { markFinished: true });
      this.logger.log(
        `finish updated sessionId="${input.sessionId}" storedUserId="${sessionUserId ?? 'null'}" status="completed" overallScore=${evaluation.report.overallScore}`,
      );
    } catch (error) {
      this.logger.error(
        `finish failed sessionId="${input.sessionId}" authenticatedUserId="${input.authenticatedUserId}" error="${error instanceof Error ? error.message : String(error)}"`,
      );
      throw new InternalServerErrorException({
        error: 'SESSION_UPDATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      sessionId: input.sessionId,
      userId,
      topic,
      experience,
      difficulty,
      totalQuestions,
      answers: alignedAnswers,
      status: 'completed',
      report: evaluation.report,
      questionResults: evaluation.questionResults,
      debugTrace: evaluation.debugTrace,
    };
  }

  private async buildPlan(input: StartSessionDto, userId?: string) {
    void userId;
    const topicId = toTopicId(input.topic);
    if (!topicId) {
      throw new HttpException({
        error: 'UNSUPPORTED_TOPIC',
        topic: input.topic,
        supported: Object.keys(TOPIC_DISPLAY_MAP),
      }, 400);
    }
    try {
      const { questions, deficit } = this.questionAssembly.assemble({
        topicId,
        difficulty: input.difficulty,
        experience: input.experience,
        totalQuestions: input.totalQuestions,
        excludeQuestionIds: input.recentQuestionIds ?? [],
      });

      const questionPlan = questions.map((instance) => ({
        questionId: instance.questionId,
        topicId: instance.topicId,
        familyKey: instance.familyKey,
        archetype: instance.archetype,
        hookId: instance.hookId,
        concepts: instance.concepts,
        subtopic: instance.subtopic,
        rubricId: instance.rubricId,
        constraintSnapshot: instance.constraintSnapshot,
        renderedQuestion: instance.rendered.text,
      })) as StoredQuestionPlanItem[];

      return { questionPlan, deficit };
    } catch (error) {
      throw new HttpException(
        { error: 'PLAN_GENERATION_FAILED', message: (error as Error)?.message ?? 'Plan assembly failed' },
        500,
      );
    }
  }

  private extractStoredPlan(sessionId: string, session: Record<string, unknown> | null): StoredQuestionPlanItem[] {
    const plan = Array.isArray((session as { questionPlan?: unknown[] } | null)?.questionPlan)
      ? ((session as { questionPlan?: StoredQuestionPlanItem[] } | null)?.questionPlan ?? [])
      : [];

    if (!plan.length) {
      throw new HttpException({ error: 'SESSION_PLAN_MISSING', sessionId }, 500);
    }

    return plan;
  }

  private bindAnswersToPlan(
    sessionId: string,
    questionPlan: StoredQuestionPlanItem[],
    answers: Array<{ questionId: string; question: string; answer: string }>,
    options: { validateQuestionText: boolean },
  ): Array<{ questionId: string; question: string; answer: string }> {
    const planById = new Map(questionPlan.map((item) => [item.questionId, item]));
    const submittedById = new Map<string, { questionId: string; question: string; answer: string }>();

    for (const answer of answers) {
      const planItem = planById.get(answer.questionId);
      if (!planItem) {
        throw new HttpException(
          { error: 'ANSWER_BINDING_FAILED', questionId: answer.questionId, message: 'Question not found in session plan' },
          400,
        );
      }

      if (options.validateQuestionText) {
        const submittedText = (answer.question ?? '').trim().toLowerCase();
        const storedText = (planItem.renderedQuestion ?? '').trim().toLowerCase();

        if (submittedText !== storedText) {
          throw new HttpException({ error: 'QUESTION_TEXT_MISMATCH', questionId: answer.questionId }, 400);
        }
      }

      submittedById.set(answer.questionId, answer);
    }

    if (questionPlan.length === 0) {
      throw new HttpException({ error: 'SESSION_PLAN_MISSING', sessionId }, 500);
    }

    return questionPlan.map((planItem) => {
      const matched = submittedById.get(planItem.questionId);

      return {
        questionId: planItem.questionId,
        question: planItem.renderedQuestion,
        answer: matched?.answer ?? '',
      };
    });
  }
}
