import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS } from '../src/modules/curriculum/curriculum.data';
import { planSeed, seedPool } from '../src/modules/questions/pool-seeder';
import { PooledQuestion, poolId } from '../src/modules/questions/question-pool.types';
import { QUESTION_PROMPT_VERSION } from '../src/modules/questions/question-prompts';
import { FakeStorage } from './fakes';

const entry = (subtopicId: string, level: 'beginner' | 'intermediate' | 'advanced', n: number): PooledQuestion => {
  const question = `Pooled question number ${n} about ${subtopicId} at ${level} level for testing`;
  return { id: poolId(subtopicId, level, question), topicId: 'x', subtopicId, level, type: 'concept', concept: 'c', question, expectedPoints: [], commonMistakes: [], promptVersion: QUESTION_PROMPT_VERSION, uses: 0 };
};

test('plans only combinations below the target, skipping levels a subtopic is not asked at', async () => {
  const storage = new FakeStorage();
  const jobs = await planSeed(storage as never, { topicId: 'javascript', target: 3 });

  const js = TOPICS.find((topic) => topic.id === 'javascript')!;
  const expected = js.subtopics.reduce((sum, subtopic) => sum + (subtopic.minLevel === 'intermediate' ? 2 : 3), 0);
  assert.equal(jobs.length, expected);
  assert.ok(!jobs.some((job) => job.subtopicId === 'event-loop' && job.level === 'beginner'));
  assert.ok(jobs.every((job) => job.need === 3));
});

test('resumes where it left off: filled combinations are not planned again', async () => {
  const storage = new FakeStorage();
  for (let i = 0; i < 4; i += 1) storage.pool.set(`a${i}`, { ...entry('scope-closures', 'beginner', i), id: `a${i}` });
  storage.pool.set('b0', { ...entry('async-promises', 'beginner', 0), id: 'b0' });

  const jobs = await planSeed(storage as never, { topicId: 'javascript', levels: ['beginner'], target: 4 });

  assert.ok(!jobs.some((job) => job.subtopicId === 'scope-closures'));
  assert.equal(jobs.find((job) => job.subtopicId === 'async-promises')?.need, 3);
  assert.equal(jobs.find((job) => job.subtopicId === 'async-promises')?.existing.length, 1);
});

test('rejects an unknown topic instead of silently doing nothing', async () => {
  await assert.rejects(planSeed(new FakeStorage() as never, { topicId: 'cobol', target: 3 }), /Unknown topic/);
});

test('a dry run reports an estimate and makes no generator calls', async () => {
  const lines: string[] = [];
  let calls = 0;
  const generator = { generate: async () => void (calls += 1) };
  const result = await seedPool(generator as never, new FakeStorage() as never, { topicId: 'dsa', levels: ['beginner'], target: 6, batch: 6, delayMs: 0, dryRun: true, log: (line) => lines.push(line) });

  assert.equal(calls, 0);
  assert.equal(result.added, 0);
  assert.ok(lines.some((line) => /Estimated Gemini calls/.test(line)));
  assert.ok(lines.some((line) => /Nothing was written/.test(line)));
});

test('fills a combination in batches until the target is reached', async () => {
  const storage = new FakeStorage();
  const requested: number[] = [];
  let counter = 0;
  const generator = {
    generate: async (input: { total: number; level: 'beginner'; subtopicIds: string[]; avoid: string[]; usePool: boolean }) => {
      requested.push(input.total);
      assert.equal(input.usePool, false, 'seeding must not read the pool');
      for (let i = 0; i < input.total; i += 1) {
        counter += 1;
        const item = entry(input.subtopicIds[0], input.level, counter);
        storage.pool.set(item.id, item);
      }
      return [];
    },
  };
  const result = await seedPool(generator as never, storage as never, { topicId: 'dsa', levels: ['beginner'], target: 7, batch: 3, delayMs: 0, dryRun: false, log: () => undefined });

  assert.ok(result.added >= 7);
  // 7 needed with batches of 3: 3 + 3 + 1 for the first combination.
  assert.deepEqual(requested.slice(0, 3), [3, 3, 1]);
  assert.ok([...storage.pool.values()].filter((item) => item.subtopicId === 'complexity').length >= 7);
});

test('keeps going after one combination fails, and does not loop when nothing new passes review', async () => {
  const lines: string[] = [];
  let calls = 0;
  const generator = {
    generate: async (input: { subtopicIds: string[] }) => {
      calls += 1;
      if (input.subtopicIds[0] === 'complexity') throw new Error('AI busy');
      return []; // nothing new reaches the pool
    },
  };
  await seedPool(generator as never, new FakeStorage() as never, { topicId: 'dsa', levels: ['beginner'], target: 6, batch: 6, delayMs: 0, dryRun: false, log: (line) => lines.push(line) });

  const dsa = TOPICS.find((topic) => topic.id === 'dsa')!;
  const combinations = dsa.subtopics.filter((subtopic) => !subtopic.minLevel).length;
  assert.equal(calls, combinations, 'one attempt per combination, no retry loops');
  assert.ok(lines.some((line) => /complexity@beginner failed: AI busy/.test(line)));
});

test('can be limited to one subtopic, and rejects a subtopic that does not exist', async () => {
  const jobs = await planSeed(new FakeStorage() as never, { topicId: 'javascript', subtopicId: 'scope-closures', levels: ['beginner'], target: 4 });
  assert.deepEqual(jobs.map((job) => `${job.subtopicId}@${job.level}`), ['scope-closures@beginner']);
  await assert.rejects(planSeed(new FakeStorage() as never, { topicId: 'javascript', subtopicId: 'nope', target: 4 }), /Unknown subtopic/);
});
