import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTopicOrThrow } from '../src/modules/curriculum/curriculum.data';
import { planSlots } from '../src/modules/questions/slot-planner';
import { seeded } from './helpers';

const js = getTopicOrThrow('javascript');
const sd = getTopicOrThrow('system-design');

test('plans exactly the requested number of slots', () => {
  for (const total of [1, 5, 10]) {
    assert.equal(planSlots({ topic: js, level: 'beginner', total }, seeded(3)).length, total);
  }
});

test('covers distinct subtopics before repeating any', () => {
  const slots = planSlots({ topic: js, level: 'intermediate', total: js.subtopics.length }, seeded(7));
  assert.equal(new Set(slots.map((slot) => slot.subtopicId)).size, js.subtopics.length);
});

test('restricts to the subtopics the user picked and cycles when more questions are requested', () => {
  const slots = planSlots({ topic: js, level: 'beginner', total: 5, subtopicIds: ['event-loop', 'scope-closures'] }, seeded(2));
  const used = new Set(slots.map((slot) => slot.subtopicId));
  assert.deepEqual([...used].sort(), ['event-loop', 'scope-closures']);
});

test('ignores unknown subtopic ids and falls back to the whole topic', () => {
  const slots = planSlots({ topic: js, level: 'beginner', total: 4, subtopicIds: ['nope'] }, seeded(2));
  assert.ok(slots.every((slot) => js.subtopics.some((subtopic) => subtopic.id === slot.subtopicId)));
});

test('never plans coding questions for topics without code', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const slots = planSlots({ topic: sd, level: 'intermediate', total: 10 }, seeded(seed));
    assert.ok(slots.every((slot) => slot.type !== 'coding'));
  }
});

test('beginner sessions never get design questions; advanced never get plain concept questions', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    assert.ok(planSlots({ topic: js, level: 'beginner', total: 10 }, seeded(seed)).every((slot) => slot.type !== 'design'));
    assert.ok(planSlots({ topic: js, level: 'advanced', total: 10 }, seeded(seed)).every((slot) => slot.type !== 'concept'));
  }
});

test('does not repeat the same question type back to back', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const slots = planSlots({ topic: js, level: 'intermediate', total: 10 }, seeded(seed));
    for (let i = 1; i < slots.length; i += 1) assert.notEqual(slots[i].type, slots[i - 1].type);
  }
});

test('focus concepts take up to half the slots and leave the subtopic open', () => {
  const slots = planSlots({ topic: js, level: 'beginner', total: 5, focus: ['event loop', 'promises', 'closures', 'this', 'hoisting'] }, seeded(4));
  const focused = slots.filter((slot) => slot.focus);
  assert.equal(focused.length, 3);
  assert.ok(focused.every((slot) => slot.subtopicId === null));
  assert.ok(slots.filter((slot) => !slot.focus).every((slot) => slot.subtopicId !== null));
});
