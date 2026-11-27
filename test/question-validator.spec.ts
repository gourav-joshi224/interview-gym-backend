import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCandidate, similarity } from '../src/modules/questions/question-validator';
import { Slot } from '../src/modules/questions/slot-planner';
import { getTopicOrThrow } from '../src/modules/curriculum/curriculum.data';
import { rawQuestion } from './helpers';

const allowed = new Set(getTopicOrThrow('javascript').subtopics.map((subtopic) => subtopic.id));
const slot: Slot = { index: 0, topicId: 'javascript', subtopicId: 'scope-closures', type: 'concept' };
const ctx = (level: 'beginner' | 'intermediate' | 'advanced' = 'beginner', knownTexts: string[] = []) => ({
  level,
  allowedSubtopicIds: allowed,
  knownTexts,
});

const reasons = (result: ReturnType<typeof validateCandidate>) => (result.ok ? [] : result.reasons);

test('accepts a clean beginner question', () => {
  assert.equal(validateCandidate(rawQuestion(), slot, ctx()).ok, true);
});

test('rejects a beginner question with production scale numbers', () => {
  const bad = rawQuestion({ question: 'Your API serves 50,000 requests per second. How does a JavaScript closure help with caching the config?' });
  assert.ok(reasons(validateCandidate(bad, slot, ctx())).includes('beginner-scale-or-incident'));
});

test('rejects a beginner question about outages and on-call incidents', () => {
  const bad = rawQuestion({ question: 'During an outage you are on-call and a closure leaks memory. What do you do first and why?' });
  assert.ok(reasons(validateCandidate(bad, slot, ctx())).includes('beginner-scale-or-incident'));
});

test('does not flag a harmless beginner DSA question that mentions a big array', () => {
  const dsa = new Set(getTopicOrThrow('dsa').subtopics.map((subtopic) => subtopic.id));
  const ok = rawQuestion({ subtopicId: 'complexity', question: 'What is the time complexity of finding the maximum in an unsorted array of one million integers, and why?' });
  const result = validateCandidate(ok, { index: 0, topicId: 'dsa', subtopicId: 'complexity', type: 'concept' }, { level: 'beginner', allowedSubtopicIds: dsa, knownTexts: [] });
  assert.equal(result.ok, true);
});

test('rejects a model that answers with the wrong level or the wrong subtopic', () => {
  assert.ok(reasons(validateCandidate(rawQuestion({ level: 'advanced' }), slot, ctx())).includes('level-mismatch'));
  assert.ok(reasons(validateCandidate(rawQuestion({ subtopicId: 'event-loop' }), slot, ctx())).includes('subtopic-mismatch'));
  assert.ok(reasons(validateCandidate(rawQuestion({ subtopicId: 'made-up' }), slot, ctx())).includes('unknown-subtopic'));
});

test('rejects bare definition questions above beginner level', () => {
  const bad = rawQuestion({ level: 'advanced', question: 'What is a closure in JavaScript?' });
  assert.ok(reasons(validateCandidate(bad, slot, ctx('advanced'))).includes('definition-only'));
});

test('rejects near-duplicates of questions already seen', () => {
  const seen = 'What is a closure in JavaScript and why can an inner function still read variables after the outer function returns?';
  const near = rawQuestion({ question: 'What is a closure in JavaScript, and why can an inner function still read variables after an outer function has returned?' });
  assert.ok(reasons(validateCandidate(near, slot, ctx('beginner', [seen]))).includes('duplicate'));
});

test('does not call two different questions duplicates', () => {
  assert.ok(similarity('Explain the JavaScript event loop and microtasks ordering', 'How does prototype inheritance resolve property lookups') < 0.3);
});

test('needs at least two expected points and a concept', () => {
  assert.ok(reasons(validateCandidate(rawQuestion({ expectedPoints: [{ text: 'only one point here', weight: 3 }] }), slot, ctx())).includes('bad-expected-points'));
  assert.ok(reasons(validateCandidate(rawQuestion({ concept: '' }), slot, ctx())).includes('missing-concept'));
});

test('counts words outside code blocks only', () => {
  const code = '```js\n' + 'const a = 1;\n'.repeat(60) + '```';
  const withCode = rawQuestion({ type: 'coding', question: `What does this print, and why does it behave that way?\n${code}` });
  assert.equal(validateCandidate(withCode, slot, ctx()).ok, true);
  const wordy = rawQuestion({ question: 'word '.repeat(100) });
  assert.ok(reasons(validateCandidate(wordy, slot, ctx())).includes('too-wordy'));
});

test('clamps point weights into 1..3 and defaults a missing weight', () => {
  const result = validateCandidate(
    rawQuestion({ expectedPoints: [{ text: 'first expected point', weight: 9 }, { text: 'second expected point' }] }),
    slot,
    ctx(),
  );
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.question.expectedPoints.map((point) => point.weight), [3, 2]);
});

test('repairs a code snippet the model put on a single line', () => {
  const oneLine = rawQuestion({
    type: 'coding',
    question: 'What is the output order and why? ```js console.log("A"); setTimeout(() => console.log("B"), 0); console.log("D"); ```',
  });
  const result = validateCandidate(oneLine, slot, ctx());
  assert.ok(result.ok);
  if (result.ok) {
    assert.match(result.question.question, /```js\nconsole\.log\("A"\);\nsetTimeout/);
    assert.match(result.question.question, /\n```$/);
  }
});

test('leaves a correctly formatted snippet alone', () => {
  const fine = rawQuestion({ type: 'coding', question: 'What does this print and why?\n```js\nconst a = 1;\nconsole.log(a);\n```' });
  const result = validateCandidate(fine, slot, ctx());
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.question.question.match(/```/g)?.length, 2);
});

import { sanitizeMarkup } from '../src/modules/questions/question-validator';

test('keeps well-formed inline code and key terms', () => {
  const text = 'A **counter** function declares `let count = 0` and returns an inner function.';
  assert.equal(sanitizeMarkup(text), text);
});

test('removes unbalanced markers instead of leaking them to the screen', () => {
  assert.equal(sanitizeMarkup('Unbalanced `tick and **bold here'), 'Unbalanced tick and bold here');
});

test('strips headings, links and empty markers that the UI does not render', () => {
  assert.equal(sanitizeMarkup('## Title [docs](http://x.io) and ``empty`` and ****'), 'Title docs and empty and ');
});

test('does not touch fenced code blocks', () => {
  const text = 'Why?\n```js\nconst a = `x`;\n```';
  assert.equal(sanitizeMarkup(text), text);
});

test('a bold term inside code collapses to plain code', () => {
  assert.equal(sanitizeMarkup('Nested `**x**` inside'), 'Nested `x` inside');
});

test('marker characters do not count against the word limit', () => {
  const marked = rawQuestion({ question: `What does **${'closure '.repeat(1)}** do with \`count\` when the outer function returns and why is it useful here?` });
  assert.equal(validateCandidate(marked, slot, ctx()).ok, true);
});
