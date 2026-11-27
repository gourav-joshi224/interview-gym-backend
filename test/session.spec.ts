import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionService } from '../src/modules/session/session.service';
import { FakeStorage } from './fakes';
import { fakeConfig, planItem } from './helpers';

const PLAN = [planItem(0), planItem(1), planItem(2)];

type HttpError = { getStatus?: () => number; getResponse?: () => { error?: string } };
/** Matches an HTTP exception by status and, when given, its machine-readable error code. */
const httpError = (status: number, code?: string) => (error: HttpError) =>
  error.getStatus?.() === status && (code === undefined || error.getResponse?.().error === code);

function build(overrides: { plan?: typeof PLAN; evaluateCalls?: { count: number } } = {}) {
  const storage = new FakeStorage();
  const counter = overrides.evaluateCalls ?? { count: 0 };
  const generator = { generate: async () => overrides.plan ?? PLAN };
  const evaluation = {
    evaluate: async () => {
      counter.count += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        report: { overallScore: 70, readiness: 'interview_ready', strengths: [], weakAreas: [], communicationFeedback: '', technicalFeedback: '', improvementPlan: '', skillBreakdown: [], learningResources: [] },
        questionResults: [],
      };
    },
  };
  const service = new SessionService(storage as never, generator as never, evaluation as never, fakeConfig({ 'limits.maxSessionsPerDay': 5 }) as never);
  return { service, storage, counter };
}

const startInput = { topic: 'javascript', level: 'beginner' as const, totalQuestions: 3 };

test('start stores the plan and returns the first question with the real question count', async () => {
  const { service, storage } = build({ plan: PLAN.slice(0, 2) });
  const started = await service.start('u1', { ...startInput, totalQuestions: 5 });

  assert.equal(started.totalQuestions, 2);
  assert.equal(started.questionNumber, 1);
  assert.equal(started.questionId, PLAN[0].questionId);
  assert.equal(storage.sessions.get(started.sessionId)?.userId, 'u1');
});

test('start rejects unknown topics, unknown subtopics and a spent daily limit', async () => {
  const { service, storage } = build();
  await assert.rejects(service.start('u1', { ...startInput, topic: 'cobol' }), httpError(400, 'UNSUPPORTED_TOPIC'));
  await assert.rejects(service.start('u1', { ...startInput, subtopics: ['nope'] }), httpError(400, 'UNKNOWN_SUBTOPIC'));
  storage.sinceCount = 5;
  await assert.rejects(service.start('u1', startInput), httpError(429, 'DAILY_LIMIT_REACHED'));
});

test('start fails with 503 when no question could be generated', async () => {
  const { service } = build({ plan: [] });
  await assert.rejects(service.start('u1', startInput), httpError(503, 'QUESTION_GENERATION_FAILED'));
});

test('accepts topic labels used by older clients', async () => {
  const { service } = build();
  const started = await service.start('u1', { ...startInput, topic: 'Node.js' });
  assert.ok(started.sessionId);
});

test('walks through every question in order, then reports done', async () => {
  const { service } = build();
  const { sessionId } = await service.start('u1', startInput);

  const first = await service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'answer one' });
  assert.equal(first.done, false);
  assert.equal(first.questionId, PLAN[1].questionId);
  assert.equal(first.questionNumber, 2);

  await service.progress('u1', { sessionId, questionId: PLAN[1].questionId, answer: 'answer two' });
  const last = await service.progress('u1', { sessionId, questionId: PLAN[2].questionId, answer: 'answer three' });
  assert.equal(last.done, true);
  assert.equal(last.question, undefined);
});

test('rejects out-of-order answers and does not store them', async () => {
  const { service, storage } = build();
  const { sessionId } = await service.start('u1', startInput);
  await assert.rejects(service.progress('u1', { sessionId, questionId: PLAN[2].questionId, answer: 'skipping ahead' }), httpError(409, 'OUT_OF_ORDER'));
  assert.equal(storage.sessions.get(sessionId)?.answers.length, 0);
});

test('a retried submission overwrites instead of duplicating', async () => {
  const { service, storage } = build();
  const { sessionId } = await service.start('u1', startInput);
  await service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'first try' });
  const retry = await service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'second try' });

  assert.equal(storage.sessions.get(sessionId)?.answers.length, 1);
  assert.equal(storage.sessions.get(sessionId)?.answers[0].answer, 'second try');
  assert.equal(retry.questionId, PLAN[1].questionId);
});

test('other users cannot read, answer or finish a session, and get the same 404 as a missing one', async () => {
  const { service } = build();
  const { sessionId } = await service.start('owner', startInput);
  const notFound = httpError(404, 'SESSION_NOT_FOUND');

  await assert.rejects(service.get('intruder', sessionId), notFound);
  await assert.rejects(service.progress('intruder', { sessionId, questionId: PLAN[0].questionId, answer: 'x' }), notFound);
  await assert.rejects(service.finish('intruder', { sessionId }), notFound);
  await assert.rejects(service.get('owner', 'does-not-exist'), notFound);
});

test('finish needs every question answered', async () => {
  const { service, counter } = build();
  const { sessionId } = await service.start('u1', startInput);
  await service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'only one' });
  await assert.rejects(service.finish('u1', { sessionId }), httpError(409, 'INCOMPLETE_SESSION'));
  assert.equal(counter.count, 0);
});

async function answerAll(service: SessionService, sessionId: string) {
  for (const item of PLAN) await service.progress('u1', { sessionId, questionId: item.questionId, answer: `answer for ${item.questionId}` });
}

test('finish grades once, stores the report, and returns the stored report on repeat calls', async () => {
  const { service, counter, storage } = build();
  const { sessionId } = await service.start('u1', startInput);
  await answerAll(service, sessionId);

  const first = await service.finish('u1', { sessionId });
  const second = await service.finish('u1', { sessionId });

  assert.equal(counter.count, 1);
  assert.equal((first.report as { overallScore: number }).overallScore, 70);
  assert.deepEqual(second.report, first.report);
  assert.equal(storage.sessions.get(sessionId)?.status, 'completed');
  assert.equal(storage.completed.length, 1);
});

test('concurrent finish calls (double click) share one grading run', async () => {
  const { service, counter } = build();
  const { sessionId } = await service.start('u1', startInput);
  await answerAll(service, sessionId);

  await Promise.all([service.finish('u1', { sessionId }), service.finish('u1', { sessionId }), service.finish('u1', { sessionId })]);
  assert.equal(counter.count, 1);
});

test('a finished session cannot be answered again', async () => {
  const { service } = build();
  const { sessionId } = await service.start('u1', startInput);
  await answerAll(service, sessionId);
  await service.finish('u1', { sessionId });
  await assert.rejects(service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'late' }), httpError(409, 'SESSION_COMPLETED'));
});

test('sessions created by the old template engine are refused with a clear message', async () => {
  const { service, storage } = build();
  const { sessionId } = await service.start('u1', startInput);
  const session = storage.sessions.get(sessionId);
  if (session) session.questionPlan = session.questionPlan.map((item) => ({ ...item, expectedPoints: undefined as never }));
  await assert.rejects(service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'x' }), httpError(409, 'SESSION_OUTDATED'));
});

test('get returns the position needed to resume after a refresh', async () => {
  const { service } = build();
  const { sessionId } = await service.start('u1', startInput);
  await service.progress('u1', { sessionId, questionId: PLAN[0].questionId, answer: 'one' });
  const state = await service.get('u1', sessionId);

  assert.equal(state.answeredCount, 1);
  assert.equal(state.questionNumber, 2);
  assert.equal(state.questionId, PLAN[1].questionId);
  assert.equal(state.done, false);
});
