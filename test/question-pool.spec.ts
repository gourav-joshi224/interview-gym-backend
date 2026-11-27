import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTopicOrThrow } from '../src/modules/curriculum/curriculum.data';
import { QUESTION_PROMPT_VERSION } from '../src/modules/questions/question-prompts';
import { PooledQuestion, poolId } from '../src/modules/questions/question-pool.types';
import { FakeGemini, FakeStorage } from './fakes';
import { fakeConfig, makeGenerator, rawQuestion } from './helpers';

const js = getTopicOrThrow('javascript');
const baseConfig = { 'gemini.model': 'gen', 'gemini.judgeModel': 'judge' };

const TEXTS = [
  'What does the temporal dead zone prevent when you use let and const in JavaScript?',
  'Why does a loop with var print the same value inside timeout callbacks, while let does not?',
  'How does a closure let an inner function keep using a variable after the outer function returns?',
  'What is the difference between function scope and block scope in JavaScript, with an example?',
  'Why can two functions created in the same loop share one captured variable by accident?',
  'What does hoisting do to a var declaration compared with a function declaration?',
];

function pooled(i: number, overrides: Partial<PooledQuestion> = {}): PooledQuestion {
  const question = TEXTS[i % TEXTS.length] + (i >= TEXTS.length ? ` Variant ${i}.` : '');
  return {
    id: poolId('scope-closures', 'beginner', question),
    topicId: 'javascript',
    subtopicId: 'scope-closures',
    level: 'beginner',
    type: 'concept',
    concept: `Concept ${i}`,
    question,
    expectedPoints: [
      { text: 'States the core mechanism correctly', weight: 3 },
      { text: 'Gives a small concrete example', weight: 2 },
    ],
    commonMistakes: [],
    promptVersion: QUESTION_PROMPT_VERSION,
    uses: 0,
    ...overrides,
  };
}

const seed = (storage: FakeStorage, items: PooledQuestion[]) => items.forEach((item) => storage.pool.set(item.id, item));
const writerCalls = (gemini: FakeGemini) => gemini.calls.filter((call) => call.model === 'gen');

const FRESH = [
  'Why do two callbacks created inside one forEach loop each see their own copy of the loop variable?',
  'What happens when an inner function reads a variable that an outer function later reassigns?',
  'How does JavaScript decide which variable a name refers to when the same name exists in two scopes?',
  'What problem does wrapping code in an immediately invoked function solve in older JavaScript?',
  'Why does accessing a let variable before its declaration throw while a var returns undefined?',
  'How can a function remember how many times it has been called without using a global variable?',
  'What is the scope chain and in what order does the engine search it for a variable?',
  'Why is a variable declared inside an if block unavailable outside it when declared with const?',
];
const answerSlots = (input: { prompt: string }) => ({
  questions: [...input.prompt.matchAll(/- slot (\d+) \|(?: subtopicId="([^"]+)")?/g)].map((m) =>
    rawQuestion({ slot: +m[1], subtopicId: m[2] ?? 'scope-closures', question: FRESH[+m[1] % FRESH.length] }),
  ),
});
const approve = (input: { prompt: string }) => ({
  verdicts: [...input.prompt.matchAll(/\[slot (\d+)\]/g)].map((m) => ({ slot: +m[1], onTopic: true, levelFit: 'ok', clear: true, reason: '' })),
});

const request = { topic: js, level: 'beginner' as const, subtopicIds: ['scope-closures'] };

test('a full pool serves the whole session with zero Gemini calls', async () => {
  const gemini = new FakeGemini([]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3, 4].map((i) => pooled(i)));

  const plan = await generator.generate({ ...request, total: 3 });

  assert.equal(plan.length, 3);
  assert.equal(gemini.calls.length, 0);
  assert.equal(new Set(plan.map((item) => item.renderedQuestion)).size, 3);
  assert.ok(plan.every((item) => item.level === 'beginner' && item.subtopicId === 'scope-closures'));
});

test('pooled questions get new ids and keep their key points, so grading works as usual', async () => {
  const { generator, storage } = makeGenerator(new FakeGemini([]), fakeConfig(baseConfig));
  seed(storage, [0, 1, 2].map((i) => pooled(i)));
  const [first] = await generator.generate({ ...request, total: 1 });

  assert.match(first.questionId, /^javascript\.scope-closures::[0-9a-f]{8}$/);
  assert.ok(![...storage.pool.keys()].some((id) => first.questionId.includes(id)));
  assert.equal(first.expectedPoints.length, 2);
  assert.ok(first.concept.startsWith('Concept'));
});

test('serving from the pool records usage, and the least-used questions are served first', async () => {
  const { generator, storage } = makeGenerator(new FakeGemini([]), fakeConfig(baseConfig));
  seed(storage, [pooled(0, { uses: 9 }), pooled(1, { uses: 0 }), pooled(2, { uses: 5 }), pooled(3, { uses: 0 })]);

  const plan = await generator.generate({ ...request, total: 2 });

  assert.equal(storage.usedLog.length, 2);
  const served = plan.map((item) => item.renderedQuestion);
  assert.ok(served.includes(pooled(1).question) && served.includes(pooled(3).question), served.join(' | '));
});

test('only the slots the pool cannot cover are sent to Gemini', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2].map((i) => pooled(i))); // exactly the minimum, and two slots will use two of them

  // Three slots, but after two are served only one question is left, below the minimum of three: the third is generated.
  const plan = await generator.generate({ ...request, total: 3 });

  assert.equal(plan.length, 3);
  assert.equal(writerCalls(gemini).length, 1);
  const asked = [...writerCalls(gemini)[0].prompt.matchAll(/- slot (\d+) \|/g)].map((m) => m[1]);
  assert.equal(asked.length, 3 - plan.filter((item) => TEXTS.includes(item.renderedQuestion)).length);
});

test('a pool below the reuse minimum is ignored and gets filled instead', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [pooled(0), pooled(1)]); // 2 < 3

  const plan = await generator.generate({ ...request, total: 2 });

  assert.equal(plan.length, 2);
  assert.equal(writerCalls(gemini).length, 1);
  assert.ok(plan.every((item) => !TEXTS.includes(item.renderedQuestion)));
  assert.equal(storage.pool.size, 4, 'the two new reviewed questions were added');
});

test('a user never gets a pooled question they have already seen', async () => {
  const { generator, storage } = makeGenerator(new FakeGemini([answerSlots, approve]), fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3, 4].map((i) => pooled(i)));
  const seen = [pooled(0).question, pooled(1).question];

  const plan = await generator.generate({ ...request, total: 3, avoid: seen });

  const served = plan.map((item) => item.renderedQuestion);
  assert.ok(!served.includes(seen[0]) && !served.includes(seen[1]), served.join(' | '));
});

test('a question that merely rephrases one the user saw is also skipped', async () => {
  const { generator, storage } = makeGenerator(new FakeGemini([answerSlots, approve]), fakeConfig(baseConfig));
  seed(storage, [0, 1, 2].map((i) => pooled(i)));
  const rephrased = 'What does the temporal dead zone prevent when you use const and let in JavaScript code?';

  const plan = await generator.generate({ ...request, total: 1, avoid: [rephrased] });

  assert.ok(!plan.some((item) => item.renderedQuestion === pooled(0).question));
});

test('the same pooled question is never used twice in one session', async () => {
  const { generator, storage } = makeGenerator(new FakeGemini([]), fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3, 4, 5].map((i) => pooled(i)));
  const plan = await generator.generate({ ...request, total: 4 });
  assert.equal(new Set(plan.map((item) => item.renderedQuestion)).size, plan.length);
});

test('the fresh-generation share sends some questions to Gemini even when the pool could serve them', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig({ ...baseConfig, 'pool.freshRate': 0.5 }), new FakeStorage(), 0.1);
  seed(storage, [0, 1, 2, 3, 4].map((i) => pooled(i)));

  const plan = await generator.generate({ ...request, total: 2 });

  assert.equal(plan.length, 2);
  assert.equal(writerCalls(gemini).length, 1);
  assert.ok(plan.every((item) => !TEXTS.includes(item.renderedQuestion)));
});

test('a retry-weak-areas question never reads from or writes to the shared pool', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3].map((i) => pooled(i)));
  const before = storage.pool.size;

  // One question and one focus concept: the only slot is a focus slot.
  await generator.generate({ topic: js, level: 'beginner', total: 1, focus: ['my private weak concept'] });

  assert.equal(storage.poolReads, 0);
  assert.equal(storage.pool.size, before);
  assert.equal(writerCalls(gemini).length, 1);
});

test('in a mixed retry session only the focus slot stays out of the pool', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig({ ...baseConfig, 'pool.minToReuse': 99 }));

  // Two questions, one focus concept: slot 0 is a focus slot, slot 1 is an ordinary slot.
  await generator.generate({ topic: js, level: 'beginner', total: 2, focus: ['my private weak concept'] });

  assert.equal(storage.pool.size, 1, 'only the ordinary question was shared');
  assert.ok(![...storage.pool.values()].some((item) => /private/i.test(item.question)));
});

test('only questions the reviewer explicitly approved are shared', async () => {
  const rejectSecond = (input: { prompt: string }) => ({
    verdicts: [...input.prompt.matchAll(/\[slot (\d+)\]/g)].map((m) => ({ slot: +m[1], onTopic: true, levelFit: +m[1] === 1 ? 'too_hard' : 'ok', clear: true, reason: 'hard' })),
  });
  const gemini = new FakeGemini([answerSlots, rejectSecond, () => ({ questions: [] }), approve, () => ({ questions: [] }), approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));

  const plan = await generator.generate({ ...request, total: 2 });

  assert.equal(plan.length, 1);
  assert.equal(storage.pool.size, 1);
  assert.equal([...storage.pool.values()][0].question, plan[0].renderedQuestion);
});

test('questions accepted while the reviewer was down are not pooled', async () => {
  const gemini = new FakeGemini([answerSlots, () => { throw new Error('reviewer down'); }]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  const plan = await generator.generate({ ...request, total: 2 });
  assert.equal(plan.length, 2);
  assert.equal(storage.pool.size, 0);
});

test('a pooled question that fails today’s validation is skipped instead of served', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  const tooScary = 'Your API handles 50,000 requests per second during an outage. How do closures help here in JavaScript?';
  seed(storage, [pooled(0, { question: tooScary, id: poolId('scope-closures', 'beginner', tooScary) }), pooled(1), pooled(2), pooled(3)]);

  const plan = await generator.generate({ ...request, total: 3 });

  assert.ok(plan.every((item) => item.renderedQuestion !== tooScary));
  assert.equal(plan.length, 3);
});

test('questions never cross levels or prompt versions', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3].map((i) => pooled(i, { level: 'advanced', id: `adv${i}` })));
  seed(storage, [4, 5, 0].map((i) => pooled(i, { promptVersion: QUESTION_PROMPT_VERSION + 1, id: `old${i}` })));

  const plan = await generator.generate({ ...request, total: 2 });

  assert.ok(plan.every((item) => item.level === 'beginner'));
  assert.equal(writerCalls(gemini).length, 1, 'nothing usable was pooled for this level and version');
});

test('a pool outage falls back to generating, and a failed save never fails the session', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  storage.failPoolRead = true;
  storage.failPoolWrite = true;

  const plan = await generator.generate({ ...request, total: 2 });
  assert.equal(plan.length, 2);
  assert.equal(writerCalls(gemini).length, 1);
});

test('turning the pool off restores plain generation with no reads or writes', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig({ ...baseConfig, 'pool.enabled': false }));
  seed(storage, [0, 1, 2, 3].map((i) => pooled(i)));
  const before = storage.pool.size;

  await generator.generate({ ...request, total: 2 });

  assert.equal(storage.poolReads, 0);
  assert.equal(storage.pool.size, before);
  assert.equal(writerCalls(gemini).length, 1);
});

test('near-duplicates and a full subtopic are not added to the pool', async () => {
  const sameAsPooled = (input: { prompt: string }) => ({
    questions: [...input.prompt.matchAll(/- slot (\d+) \| subtopicId="([^"]+)"/g)].map((m) => rawQuestion({ slot: +m[1], subtopicId: m[2], question: 'What does the temporal dead zone prevent when you use const and let in JavaScript code?' })),
  });
  const gemini = new FakeGemini([sameAsPooled, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig({ ...baseConfig, 'pool.minToReuse': 99 }));
  seed(storage, [pooled(0)]);
  await generator.generate({ ...request, total: 1 });
  assert.equal(storage.pool.size, 1, 'a rephrasing of an existing pooled question is not stored again');

  const full = makeGenerator(new FakeGemini([answerSlots, approve]), fakeConfig({ ...baseConfig, 'pool.minToReuse': 99, 'pool.maxPerKey': 2 }));
  seed(full.storage, [pooled(1), pooled(2)]);
  await full.generator.generate({ ...request, total: 1 });
  assert.equal(full.storage.pool.size, 2, 'a subtopic at its cap stops growing');
});

test('usePool false (used when pre-filling) skips reading but still stores what it writes', async () => {
  const gemini = new FakeGemini([answerSlots, approve]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3].map((i) => pooled(i)));

  await generator.generate({ ...request, total: 2, usePool: false });

  assert.equal(storage.poolReads, 0);
  assert.equal(writerCalls(gemini).length, 1);
  assert.equal(storage.pool.size, 6);
});

test('resume sessions reuse the pool per topic too', async () => {
  const gemini = new FakeGemini([]);
  const { generator, storage } = makeGenerator(gemini, fakeConfig(baseConfig));
  seed(storage, [0, 1, 2, 3].map((i) => pooled(i)));
  const plan = await generator.generateMixed({
    level: 'beginner',
    groups: [{ topic: js, count: 2, subtopicIds: ['scope-closures'] }],
  });
  assert.equal(plan.length, 2);
  assert.equal(gemini.calls.length, 0);
});
