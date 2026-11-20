import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { GeminiService } from '../src/modules/llm/gemini.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { FakeGemini, FakeStorage } from './fakes';
import { rawQuestion } from './helpers';

process.env.NODE_ENV = 'test';

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const uid = request.headers['x-test-uid'];
    if (!uid) return false;
    request.user = { uid };
    return true;
  }
}

const POOL = [
  'How does a hash map find a value by key in constant time on average, and what causes collisions?',
  'Why does binary search need a sorted array, and what is its time complexity?',
  'What is the difference between a stack and a queue, and when would you pick each one?',
  'How does breadth first search visit nodes in a graph, and which data structure drives it?',
  'Why does merge sort take n log n time even in the worst case?',
];

const gemini = new FakeGemini([]);
// Respond by prompt content so the order of calls does not matter.
gemini.generateJson = async <T>(input: { prompt: string; system: string; files?: unknown[] }): Promise<T> => {
  if (input.files?.length) {
    return {
      isResume: true,
      roleSummary: 'Backend engineer',
      yearsExperience: 6,
      skills: [
        { topicId: 'nodejs', subtopicIds: ['http-middleware'], evidence: 'Built REST services', strength: 'core' },
        { topicId: 'databases', subtopicIds: ['indexing'], evidence: 'Tuned Postgres queries', strength: 'used' },
        { topicId: 'kubernetes', subtopicIds: [], evidence: 'Not a real topic', strength: 'core' },
      ],
      unmapped: ['Docker'],
    } as T;
  }
  if (input.prompt.includes('QUESTIONS\n[slot')) {
    return { verdicts: [...input.prompt.matchAll(/\[slot (\d+)\]/g)].map((m) => ({ slot: +m[1], onTopic: true, levelFit: 'ok', clear: true, reason: '' })) } as T;
  }
  if (input.prompt.includes('Expected points')) {
    const indexes = [...input.prompt.matchAll(/Question index (\d+)/g)].map((m) => +m[1]);
    return {
      results: indexes.map((index) => ({
        index,
        points: [0, 1].map((pointIndex) => ({ pointIndex, verdict: 'covered', evidence: 'quoted' })),
        misconceptions: [],
        strengths: ['ok'],
        feedback: 'Good.',
        idealAnswer: 'Ideal.',
      })),
      summary: { strengths: ['s'], weakAreas: [], communicationFeedback: 'c', technicalFeedback: 't', improvementPlan: 'p' },
    } as T;
  }
  const slots = [...input.prompt.matchAll(/- slot (\d+) \|(?: topic="[^"]+" \|)? subtopicId="([^"]+)"/g)];
  return { questions: slots.map((m, i) => rawQuestion({ slot: +m[1], subtopicId: m[2], question: POOL[i % POOL.length] })) } as T;
};

let app: INestApplication;
let base = '';

before(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(FirebaseAuthGuard)
    .useClass(HeaderAuthGuard)
    .overrideProvider(StorageService)
    .useValue(new FakeStorage())
    .overrideProvider(GeminiService)
    .useValue(gemini)
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0);
  base = await app.getUrl();
});

after(async () => {
  await app.close();
});

const call = (path: string, init: { method?: string; uid?: string; body?: unknown } = {}) =>
  fetch(`${base}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(init.uid ? { 'x-test-uid': init.uid } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

test('GET /curriculum is public and lists DSA with its subtopics and the three levels', async () => {
  const response = await call('/curriculum');
  assert.equal(response.status, 200);
  const body = (await response.json()) as { topics: Array<{ id: string; subtopics: unknown[] }>; levels: Array<{ id: string }> };
  assert.deepEqual(body.levels.map((level) => level.id), ['beginner', 'intermediate', 'advanced']);
  assert.ok(body.topics.some((topic) => topic.id === 'dsa' && topic.subtopics.length > 5));
  assert.ok(!body.topics.some((topic) => ['java', 'c'].includes(topic.id)));
});

test('GET /health works without auth', async () => {
  assert.equal((await call('/health')).status, 200);
});

test('session routes require authentication', async () => {
  assert.equal((await call('/session/start', { body: { topic: 'dsa', level: 'beginner', totalQuestions: 3 } })).status, 403);
  assert.equal((await call('/dashboard/my-sessions')).status, 403);
});

test('input validation rejects bad levels, counts and oversized answers', async () => {
  const bad = (body: unknown) => call('/session/start', { uid: 'u', body });
  assert.equal((await bad({ topic: 'dsa', level: 'epic', totalQuestions: 3 })).status, 400);
  assert.equal((await bad({ topic: 'dsa', level: 'beginner', totalQuestions: 50 })).status, 400);
  assert.equal((await bad({ topic: 'dsa', level: 'beginner', totalQuestions: 0 })).status, 400);
  const huge = await call('/session/progress', { uid: 'u', body: { sessionId: 's', questionId: 'q', answer: 'x'.repeat(8001) } });
  assert.equal(huge.status, 400);
});

const keys = (value: unknown) => Object.keys(value as object).sort();

test('response shapes match what the frontend types expect', async () => {
  const started = (await (await call('/session/start', { uid: 'bob', body: { topic: 'dsa', level: 'beginner', totalQuestions: 2 } })).json()) as Record<string, unknown>;
  assert.deepEqual(keys(started), ['done', 'level', 'mode', 'question', 'questionId', 'questionNumber', 'sessionId', 'topic', 'totalQuestions']);

  const sessionId = started.sessionId as string;
  const progressed = (await (await call('/session/progress', { uid: 'bob', body: { sessionId, questionId: started.questionId, answer: 'First answer with enough words to count.' } })).json()) as Record<string, unknown>;
  assert.deepEqual(keys(progressed), ['done', 'ok', 'question', 'questionId', 'questionNumber', 'totalQuestions']);

  const state = (await (await call(`/session/${sessionId}`, { uid: 'bob' })).json()) as Record<string, unknown>;
  assert.deepEqual(keys(state), ['answeredCount', 'done', 'focus', 'level', 'mode', 'question', 'questionId', 'questionNumber', 'sessionId', 'status', 'topic', 'totalQuestions']);

  await call('/session/progress', { uid: 'bob', body: { sessionId, questionId: progressed.questionId, answer: 'Second answer with enough words to count.' } });
  const finished = (await (await call('/session/finish', { uid: 'bob', body: { sessionId } })).json()) as Record<string, unknown>;
  assert.deepEqual(keys(finished), ['answers', 'level', 'mode', 'questionResults', 'report', 'sessionId', 'status', 'topic', 'topicId', 'topicIds', 'totalQuestions']);
  assert.deepEqual(keys(finished.report), ['communicationFeedback', 'improvementPlan', 'learningResources', 'overallScore', 'readiness', 'skillBreakdown', 'strengths', 'technicalFeedback', 'weakAreas']);
  const result = (finished.questionResults as unknown[])[0];
  assert.deepEqual(keys(result), ['attempt', 'concept', 'feedback', 'idealAnswer', 'misconceptions', 'missedCheckpoints', 'points', 'questionId', 'score', 'strengths', 'subtopic', 'topicId']);
  assert.deepEqual(keys((finished.answers as unknown[])[0]), ['answer', 'question', 'questionId']);
});

test('full interview over HTTP: start, answer every question, finish, resume state', async () => {
  const started = await call('/session/start', {
    uid: 'alice',
    body: { topic: 'dsa', level: 'beginner', subtopics: ['hashing', 'sorting-searching', 'stacks-queues'], totalQuestions: 3 },
  });
  assert.equal(started.status, 201);
  let state = (await started.json()) as { sessionId: string; questionId: string; question: string; totalQuestions: number };
  assert.equal(state.totalQuestions, 3);

  const { sessionId } = state;
  let done = false;
  let questionId = state.questionId;
  for (let i = 0; i < 3; i += 1) {
    const answered = await call('/session/progress', { uid: 'alice', body: { sessionId, questionId, answer: 'A hash map hashes the key to find a bucket, so lookup is constant time on average.' } });
    assert.equal(answered.status, 201);
    const next = (await answered.json()) as { done: boolean; questionId?: string };
    done = next.done;
    questionId = next.questionId ?? '';
  }
  assert.equal(done, true);

  assert.equal((await call(`/session/${sessionId}`, { uid: 'mallory' })).status, 404);
  const resumed = (await (await call(`/session/${sessionId}`, { uid: 'alice' })).json()) as { done: boolean; answeredCount: number };
  assert.deepEqual([resumed.done, resumed.answeredCount], [true, 3]);

  const finished = await call('/session/finish', { uid: 'alice', body: { sessionId } });
  assert.equal(finished.status, 201);
  const report = (await finished.json()) as {
    report: { overallScore: number; readiness: string; learningResources: unknown[] };
    questionResults: Array<{ idealAnswer: string }>;
  };
  assert.equal(report.report.overallScore, 100);
  assert.equal(report.report.readiness, 'strong');
  assert.equal(report.questionResults.length, 3);
  assert.ok(report.report.learningResources.length > 0);
});

const upload = (bytes: Buffer | null, type = 'application/pdf', uid = 'alice') => {
  const form = new FormData();
  if (bytes) form.append('file', new Blob([new Uint8Array(bytes)], { type }), 'resume.pdf');
  return fetch(`${base}/resume/analyze`, { method: 'POST', headers: { 'x-test-uid': uid }, body: form });
};
const PDF_BYTES = Buffer.from('%PDF-1.7\n% test body');

test('POST /resume/analyze needs auth and a file', async () => {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(PDF_BYTES)], { type: 'application/pdf' }), 'r.pdf');
  assert.equal((await fetch(`${base}/resume/analyze`, { method: 'POST', body: form })).status, 403);
  assert.equal((await upload(null)).status, 400);
});

test('POST /resume/analyze returns mapped skills and drops topics the app does not have', async () => {
  const response = await upload(PDF_BYTES, 'application/pdf', 'resume-user');
  assert.equal(response.status, 201);
  const profile = (await response.json()) as { suggestedLevel: string; skills: Array<{ topicId: string }>; unmapped: string[] };
  assert.equal(profile.suggestedLevel, 'advanced');
  assert.deepEqual(profile.skills.map((skill) => skill.topicId), ['nodejs', 'databases']);
  assert.deepEqual(profile.unmapped, ['Docker']);
});

test('POST /resume/analyze rejects non-PDF content however it is labelled', async () => {
  assert.equal((await upload(Buffer.from('plain text'), 'text/plain', 'u-a')).status, 400);
  assert.equal((await upload(Buffer.from('MZ not a pdf at all'), 'application/pdf', 'u-b')).status, 400);
});

test('POST /resume/analyze rejects files over 2 MB', async () => {
  const big = Buffer.concat([PDF_BYTES, Buffer.alloc(2 * 1024 * 1024 + 10)]);
  assert.ok([400, 413].includes((await upload(big, 'application/pdf', 'u-c')).status));
});

test('resume-mode session mixes the confirmed topics and records them', async () => {
  const started = await call('/session/start', {
    uid: 'rita',
    body: {
      mode: 'resume',
      level: 'beginner',
      totalQuestions: 4,
      skills: [
        { topicId: 'nodejs', subtopicIds: ['http-middleware'], strength: 'core' },
        { topicId: 'databases', subtopicIds: ['indexing'], strength: 'used' },
      ],
    },
  });
  assert.equal(started.status, 201);
  const body = (await started.json()) as { mode: string; topic: string; totalQuestions: number; questionId: string; sessionId: string };
  assert.equal(body.mode, 'resume');
  assert.equal(body.topic, 'Resume interview');
  assert.equal(body.totalQuestions, 4);
  assert.match(body.questionId, /^nodejs\.http-middleware::/);

  const state = (await (await call(`/session/${body.sessionId}`, { uid: 'rita' })).json()) as { mode: string };
  assert.equal(state.mode, 'resume');
});

test('resume-mode validation: skills required, unknown ids refused, topic optional only in resume mode', async () => {
  const post = (body: unknown) => call('/session/start', { uid: 'rita', body });
  assert.equal((await post({ mode: 'resume', level: 'beginner', totalQuestions: 3 })).status, 400);
  assert.equal((await post({ mode: 'resume', level: 'beginner', totalQuestions: 3, skills: [] })).status, 400);
  assert.equal((await post({ mode: 'resume', level: 'beginner', totalQuestions: 3, skills: [{ topicId: 'cobol', strength: 'core' }] })).status, 400);
  assert.equal((await post({ mode: 'resume', level: 'beginner', totalQuestions: 3, skills: [{ topicId: 'nodejs', subtopicIds: ['event-loop'], strength: 'core' }] })).status, 400);
  assert.equal((await post({ mode: 'resume', level: 'beginner', totalQuestions: 3, skills: [{ topicId: 'nodejs', strength: 'expert' }] })).status, 400);
  assert.equal((await post({ mode: 'standard', level: 'beginner', totalQuestions: 3 })).status, 400);
  assert.equal((await post({ level: 'beginner', totalQuestions: 3 })).status, 400);
});
