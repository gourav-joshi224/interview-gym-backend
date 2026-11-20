import { SessionAnswer, StoredQuestionPlanItem, StoredSession } from '../src/domain/session.types';
import { Level } from '../src/domain/levels';
import { GenerateJsonInput } from '../src/modules/llm/gemini.service';
import { NewSession } from '../src/modules/storage/storage.service';

/** Gemini stand-in: each call is answered by the next scripted responder, and every request is recorded. */
export class FakeGemini {
  calls: GenerateJsonInput[] = [];
  constructor(private readonly script: Array<(input: GenerateJsonInput) => unknown>) {}

  async generateJson<T>(input: GenerateJsonInput): Promise<T> {
    this.calls.push(input);
    const responder = this.script[this.calls.length - 1];
    if (!responder) throw new Error(`Unexpected Gemini call #${this.calls.length} (${input.model})`);
    return responder(input) as T;
  }
}

export class FakeStorage {
  sessions = new Map<string, StoredSession>();
  recent: string[] = [];
  sinceCount = 0;
  completed: string[] = [];
  private counter = 0;

  async createSession(input: NewSession): Promise<string> {
    const sessionId = `s${(this.counter += 1)}`;
    this.sessions.set(sessionId, {
      sessionId,
      userId: input.userId,
      topic: input.topic,
      topicId: input.topicId,
      level: input.level as Level,
      totalQuestions: input.totalQuestions,
      status: 'in_progress',
      answers: [],
      questionPlan: input.questionPlan as StoredQuestionPlanItem[],
      report: null,
      questionResults: null,
      focus: input.focus,
      createdAt: null,
      finishedAt: null,
    });
    return sessionId;
  }
  async getSession(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async saveAnswers(id: string, answers: SessionAnswer[]) {
    (this.sessions.get(id) as StoredSession).answers = answers;
  }
  async completeSession(id: string, report: StoredSession['report'], results: StoredSession['questionResults']) {
    const session = this.sessions.get(id) as StoredSession;
    session.status = 'completed';
    session.report = report;
    session.questionResults = results;
    this.completed.push(id);
  }
  async recentQuestionTexts() {
    return this.recent;
  }
  async countSessionsSince() {
    return this.sinceCount;
  }
}
