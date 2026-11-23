import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS } from '../src/domain/levels';
import { TOPICS } from '../src/modules/curriculum/curriculum.data';
import { ANCHORS, pickAnchors } from '../src/modules/curriculum/anchors';
import { seeded } from './helpers';

const allSubtopics = TOPICS.flatMap((topic) => topic.subtopics.map((subtopic) => ({ topic: topic.id, ...subtopic })));

test('every subtopic has anchors, so no slot is left ungrounded', () => {
  const missing = allSubtopics.filter((subtopic) => !ANCHORS[subtopic.id]).map((subtopic) => subtopic.id);
  assert.deepEqual(missing, []);
});

test('there are no anchors for subtopics that do not exist (typos)', () => {
  const known = new Set(allSubtopics.map((subtopic) => subtopic.id));
  assert.deepEqual(Object.keys(ANCHORS).filter((id) => !known.has(id)), []);
});

test('every level a subtopic can be picked at has real content', () => {
  const flat = TOPICS.flatMap((topic) => topic.subtopics);
  for (const subtopic of flat) {
    const minIndex = LEVELS.indexOf(subtopic.minLevel ?? 'beginner');
    for (const level of LEVELS) {
      if (LEVELS.indexOf(level) < minIndex) continue; // never picked automatically below its minimum level
      assert.ok(ANCHORS[subtopic.id][level].length >= 2, `${subtopic.id} has ${ANCHORS[subtopic.id][level].length} anchors at ${level}`);
    }
  }
});

test('anchors are short, specific and free of duplicates within a level', () => {
  for (const [id, entry] of Object.entries(ANCHORS)) {
    for (const level of LEVELS) {
      const list = entry[level];
      assert.equal(new Set(list).size, list.length, `${id}/${level} has duplicates`);
      for (const text of list) assert.ok(text.length >= 12 && text.length <= 160, `${id}/${level}: "${text}"`);
    }
  }
});

test('pickAnchors returns distinct anchors for the requested level', () => {
  const picked = pickAnchors('scope-closures', 'beginner', 2, seeded(3));
  assert.equal(picked.length, 2);
  assert.equal(new Set(picked).size, 2);
  assert.ok(picked.every((text) => ANCHORS['scope-closures'].beginner.includes(text)));
});

test('pickAnchors never mixes in harder-level anchors for a beginner', () => {
  const advanced = new Set(ANCHORS['scope-closures'].advanced);
  for (let seed = 1; seed <= 25; seed += 1) {
    assert.ok(pickAnchors('scope-closures', 'beginner', 3, seeded(seed)).every((text) => !advanced.has(text)));
  }
});

test('pickAnchors falls back to a lower level when a subtopic has nothing at the requested one', () => {
  const picked = pickAnchors('dynamic-programming', 'beginner', 2, seeded(1));
  assert.ok(picked.length > 0);
});

test('pickAnchors is safe for focus slots and unknown ids', () => {
  assert.deepEqual(pickAnchors(null, 'beginner'), []);
  assert.deepEqual(pickAnchors('not-a-subtopic', 'advanced'), []);
});

test('two slots on the same subtopic do not receive the same anchors when enough exist', () => {
  const used = new Set<string>();
  const first = pickAnchors('scope-closures', 'beginner', 2, seeded(1), used);
  first.forEach((text) => used.add(text));
  const second = pickAnchors('scope-closures', 'beginner', 2, seeded(2), used);
  assert.equal(second.filter((text) => first.includes(text)).length, 0);
});

test('when anchors run out, reuse beats an empty slot', () => {
  const everything = new Set(ANCHORS['scope-closures'].beginner);
  assert.equal(pickAnchors('scope-closures', 'beginner', 2, seeded(1), everything).length, 2);
});
