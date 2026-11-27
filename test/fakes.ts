import { SessionAnswer, StoredQuestionPlanItem, StoredSession } from '../src/domain/session.types';
import { Level } from '../src/domain/levels';
import { GenerateJsonInput } from '../src/modules/llm/gemini.service';
import { NewSession } from '../src/modules/storage/storage.service';
import { PooledQuestion } from '../src/modules/questions/question-pool.types';

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
      mode: input.mode,
      topic: input.topic,
      topicId: input.topicId,
      topicIds: input.topicIds,
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
  // ---- question pool
  pool = new Map<string, PooledQuestion>();
  poolReads = 0;
  poolWrites = 0;
  usedLog: string[] = [];
  failPoolRead = false;
  failPoolWrite = false;

  async poolCandidates(subtopicId: string, level: string, promptVersion: number, limit: number) {
    this.poolReads += 1;
    if (this.failPoolRead) throw new Error('pool read down');
    return [...this.pool.values()].filter((item) => item.subtopicId === subtopicId && item.level === level && item.promptVersion === promptVersion).slice(0, limit);
  }
  async poolSave(items: PooledQuestion[]) {
    if (this.failPoolWrite) throw new Error('pool write down');
    let saved = 0;
    for (const item of items) {
      if (this.pool.has(item.id)) continue;
      this.pool.set(item.id, { ...item });
      saved += 1;
    }
    this.poolWrites += saved;
    return saved;
  }
  async poolMarkUsed(ids: string[]) {
    for (const id of ids) {
      this.usedLog.push(id);
      const item = this.pool.get(id);
      if (item) item.uses += 1;
    }
  }

  async recentQuestionTexts() {
    return this.recent;
  }
  async countSessionsSince() {
    return this.sinceCount;
  }
}
