import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessAttempt } from '../src/modules/evaluation/attempt-gate';
import { overallScore, readinessFor, scoreQuestion, skillBreakdown } from '../src/modules/evaluation/scoring';

const points = [
  { text: 'a', weight: 3 },
  { text: 'b', weight: 2 },
  { text: 'c', weight: 1 },
];

test('scores from weighted verdicts', () => {
  assert.equal(scoreQuestion(points, ['covered', 'covered', 'covered'], 0), 100);
  assert.equal(scoreQuestion(points, ['missed', 'missed', 'missed'], 0), 0);
  assert.equal(scoreQuestion(points, ['covered', 'missed', 'missed'], 0), 50);
  assert.equal(scoreQuestion(points, ['partial', 'partial', 'partial'], 0), 50);
});

test('wrong statements cost points but never below zero and never when nothing was earned', () => {
  assert.equal(scoreQuestion(points, ['covered', 'covered', 'covered'], 2), 84);
  assert.equal(scoreQuestion(points, ['covered', 'covered', 'covered'], 10), 76);
  assert.equal(scoreQuestion(points, ['missed', 'missed', 'missed'], 3), 0);
});

test('a missing verdict counts as missed', () => {
  assert.equal(scoreQuestion(points, ['covered'], 0), 50);
});

test('good answers are not penalised for words the question never asked about', () => {
  // The previous keyword grader fired "red flags" on good answers. Score now depends only on verdicts.
  assert.equal(scoreQuestion(points, ['covered', 'covered', 'covered'], 0), 100);
});

test('readiness bands and averages', () => {
  assert.equal(readinessFor(39), 'not_ready');
  assert.equal(readinessFor(40), 'developing');
  assert.equal(readinessFor(60), 'interview_ready');
  assert.equal(readinessFor(80), 'strong');
  assert.equal(overallScore([{ score: 100 }, { score: 50 }, { score: 0 }]), 50);
  assert.equal(overallScore([]), 0);
});

test('skill breakdown groups by subtopic on a 0-10 scale, weakest first', () => {
  const result = skillBreakdown([
    { subtopic: 'Closures', score: 90 },
    { subtopic: 'Closures', score: 70 },
    { subtopic: 'Event loop', score: 30 },
  ]);
  assert.deepEqual(result, [
    { skill: 'Event loop', score: 3 },
    { skill: 'Closures', score: 8 },
  ]);
});

test('attempt gate rejects empty, refusals, noise and repetition', () => {
  assert.equal(assessAttempt('').attempted, false);
  assert.equal(assessAttempt('   ').attempted, false);
  assert.equal(assessAttempt('idk').attempted, false);
  assert.equal(assessAttempt("I don't know").attempted, false);
  assert.equal(assessAttempt('[skipped]').attempted, false);
  assert.equal(assessAttempt('ok').attempted, false);
  assert.equal(assessAttempt('asdf qwrtp zxcvb hjklm bnmpq xcvbn').attempted, false);
  assert.equal(assessAttempt('cache cache cache cache cache cache cache').attempted, false);
});

test('attempt gate does not treat real answers that contain refusal words as refusals', () => {
  assert.equal(assessAttempt('JavaScript passes objects by sharing, so a function can mutate the object but not rebind the caller variable.').attempted, true);
  assert.equal(assessAttempt('A closure lets an inner function skip passing state explicitly because it captures the lexical scope.').attempted, true);
  assert.equal(assessAttempt('Strengths of a B-tree include shallow depth and sequential leaf scans for range queries.').attempted, true);
});
