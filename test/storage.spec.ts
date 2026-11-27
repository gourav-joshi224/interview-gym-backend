import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FieldValue } from 'firebase-admin/firestore';
import { StorageService } from '../src/modules/storage/storage.service';
import { planItem } from './helpers';

/** Records writes so the shape of what reaches Firestore can be asserted. */
function recordingDb() {
  const writes: Array<{ op: string; id: string; data: Record<string, unknown> }> = [];
  const db = {
    collection: () => ({
      doc: (id: string) => ({
        create: async (data: Record<string, unknown>) => void writes.push({ op: 'create', id, data }),
        update: async (data: Record<string, unknown>) => void writes.push({ op: 'update', id, data }),
      }),
    }),
  };
  class TestStorage extends StorageService {
    protected override get db() {
      return db as never;
    }
  }
  return { storage: new TestStorage(), writes };
}

const isServerTimestamp = (value: unknown) => value instanceof FieldValue;

test('createSession stores real server timestamps, not empty objects', async () => {
  const { storage, writes } = recordingDb();
  await storage.createSession({
    userId: 'u1',
    mode: 'standard',
    topic: 'JavaScript',
    topicId: 'javascript',
    topicIds: ['javascript'],
    level: 'beginner',
    totalQuestions: 1,
    questionPlan: [planItem(0)],
    focus: [],
  });

  const data = writes[0].data;
  assert.ok(isServerTimestamp(data.createdAt), 'createdAt must be a server timestamp sentinel');
  assert.ok(isServerTimestamp(data.updatedAt), 'updatedAt must be a server timestamp sentinel');
  assert.notDeepEqual(data.createdAt, {});
  assert.equal(data.status, 'in_progress');
  assert.equal(data.userId, 'u1');
});

test('answers and completion keep their timestamps as sentinels too', async () => {
  const { storage, writes } = recordingDb();
  await storage.saveAnswers('s1', [{ questionId: 'q', question: 'Q?', answer: 'A' }]);
  await storage.completeSession('s1', { overallScore: 50 } as never, []);

  assert.ok(isServerTimestamp(writes[0].data.updatedAt));
  assert.ok(isServerTimestamp(writes[1].data.updatedAt));
  assert.ok(isServerTimestamp(writes[1].data.finishedAt));
});

test('undefined values are dropped instead of failing the write', async () => {
  const { storage, writes } = recordingDb();
  await storage.completeSession('s1', { overallScore: 50, readiness: undefined } as never, [{ questionId: 'q', score: 1, extra: undefined } as never]);
  assert.equal('readiness' in (writes[0].data.report as object), false);
});

test('summaries mark only unfinished, current-engine sessions as resumable', async () => {
  const docs = [
    { id: 'a', data: { status: 'in_progress', sessionVersion: 2, topic: 'DSA', level: 'beginner', totalQuestions: 5, answers: [{}, {}] } },
    { id: 'b', data: { status: 'completed', sessionVersion: 2, topic: 'DSA', level: 'beginner', totalQuestions: 5, report: { overallScore: 80 }, answers: [] } },
    { id: 'c', data: { status: 'in_progress', topic: 'DSA', difficulty: 'Hard', totalQuestions: 5 } },
  ].map((doc) => ({ id: doc.id, data: () => doc.data }));
  class Listing extends StorageService {
    protected override get db() {
      const query: Record<string, unknown> = {};
      for (const method of ['where', 'orderBy', 'limit', 'select']) query[method] = () => query;
      query.get = async () => ({ docs });
      return { collection: () => query } as never;
    }
  }
  const summaries = await new Listing().listSessionSummaries('u1', 10);
  assert.deepEqual(summaries.map((item) => [item.sessionId, item.resumable, item.answeredCount]), [['a', true, 2], ['b', false, 0], ['c', false, 0]]);
  assert.equal(summaries[2].level, 'advanced');
});

// ---- question pool

test('poolSave stores each question under its content id and ignores ones that already exist', async () => {
  const created: string[] = [];
  class Pool extends StorageService {
    protected override get db() {
      return {
        collection: (name: string) => ({
          doc: (id: string) => ({
            create: async () => {
              if (id === 'dup') throw Object.assign(new Error('exists'), { code: 6 });
              if (id === 'boom') throw Object.assign(new Error('permission'), { code: 7 });
              created.push(`${name}/${id}`);
            },
          }),
        }),
      } as never;
    }
  }
  const item = (id: string) => ({ id, topicId: 't', subtopicId: 's', level: 'beginner' as const, type: 'concept' as const, concept: 'c', question: 'q', expectedPoints: [], commonMistakes: [], promptVersion: 1, uses: 0 });
  const storage = new Pool();

  assert.equal(await storage.poolSave([item('a'), item('dup'), item('b')]), 2);
  assert.deepEqual(created, ['questionPool/a', 'questionPool/b']);
  await assert.rejects(storage.poolSave([item('boom')]), /permission/);
});

test('poolCandidates filters on subtopic, level and prompt version only', async () => {
  const filters: Array<[string, string, unknown]> = [];
  let limited = 0;
  class Pool extends StorageService {
    protected override get db() {
      const query: Record<string, unknown> = {};
      query.where = (field: string, op: string, value: unknown) => (filters.push([field, op, value]), query);
      query.limit = (n: number) => ((limited = n), query);
      query.get = async () => ({ docs: [{ id: 'x1', data: () => ({ subtopicId: 's', question: 'Q?', uses: 4 }) }] });
      return { collection: () => query } as never;
    }
  }
  const items = await new Pool().poolCandidates('scope-closures', 'beginner', 3, 60);

  assert.deepEqual(filters, [['subtopicId', '==', 'scope-closures'], ['level', '==', 'beginner'], ['promptVersion', '==', 3]]);
  assert.equal(limited, 60);
  assert.equal(items[0].id, 'x1');
  assert.equal(items[0].uses, 4);
});

test('poolMarkUsed increments the counter without touching content', async () => {
  const updates: Array<[string, Record<string, unknown>]> = [];
  class Pool extends StorageService {
    protected override get db() {
      return { collection: () => ({ doc: (id: string) => ({ update: async (data: Record<string, unknown>) => void updates.push([id, data]) }) }) } as never;
    }
  }
  await new Pool().poolMarkUsed(['a', 'b']);
  assert.deepEqual(updates.map(([id]) => id), ['a', 'b']);
  assert.ok(isServerTimestamp(updates[0][1].lastUsedAt));
  assert.deepEqual(Object.keys(updates[0][1]).sort(), ['lastUsedAt', 'uses']);
});
