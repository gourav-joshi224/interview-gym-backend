import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS } from '../src/modules/curriculum/curriculum.data';
import { SUBTOPIC_RESOURCES, selectResources, ScoredSubtopic } from '../src/modules/evaluation/resources';

const scored = (topicId: string, subtopicId: string, score: number, subtopic = subtopicId): ScoredSubtopic => ({ topicId, subtopicId, subtopic, score });

test('every subtopic has curated links over https, and no link is attached to a missing subtopic', () => {
  const known = new Set(TOPICS.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.id)));
  for (const id of known) assert.ok((SUBTOPIC_RESOURCES[id] ?? []).length > 0, `${id} has no links`);
  assert.deepEqual(Object.keys(SUBTOPIC_RESOURCES).filter((id) => !known.has(id)), []);
  for (const links of Object.values(SUBTOPIC_RESOURCES)) {
    for (const link of links) {
      assert.match(link.url, /^https:\/\//);
      assert.ok(link.title.length > 3);
    }
  }
});

test('a Node.js gap gets Node.js links, not JavaScript links', () => {
  const links = selectResources([scored('nodejs', 'streams-buffers', 20, 'Streams & buffers'), scored('javascript', 'scope-closures', 95, 'Scope & closures')]);
  assert.ok(links.length > 0);
  assert.ok(links.every((link) => link.url.includes('nodejs.org')), links.map((link) => link.url).join(', '));
  assert.ok(links.every((link) => link.reason === 'Streams & buffers'));
});

test('different weak subtopics give different links', () => {
  const closures = selectResources([scored('javascript', 'scope-closures', 10)]).map((link) => link.url);
  const eventLoop = selectResources([scored('javascript', 'event-loop', 10)]).map((link) => link.url);
  assert.notDeepEqual(closures, eventLoop);
  assert.ok(closures.some((url) => url.includes('closure')));
  assert.ok(eventLoop.some((url) => url.includes('event-loop') || url.includes('Event_loop')));
});

test('strong subtopics do not crowd out weak ones', () => {
  const links = selectResources([
    scored('caching', 'cache-patterns', 95),
    scored('databases', 'indexing', 90),
    scored('apis', 'rate-limiting', 15, 'Rate limiting & throttling'),
  ]);
  assert.ok(links.every((link) => link.reason === 'Rate limiting & throttling'));
});

test('the weakest subtopic is listed first', () => {
  const links = selectResources([scored('apis', 'versioning', 60, 'Versioning'), scored('apis', 'rate-limiting', 5, 'Rate limiting')]);
  assert.equal(links[0].reason, 'Rate limiting');
});

test('a long list of gaps gets one link each before any gets a second', () => {
  const gaps = ['scope-closures', 'event-loop', 'async-promises', 'error-handling', 'memory-gc', 'types-coercion'].map((id) => scored('javascript', id, 10, id));
  const links = selectResources(gaps);
  assert.equal(links.length, 6);
  assert.equal(new Set(links.map((link) => link.reason)).size, 6);
});

test('results never repeat a URL and respect the cap', () => {
  const same = [scored('system-design', 'caching-cdn', 10), scored('caching', 'cache-patterns', 10), scored('caching', 'distributed-caching', 10), scored('apis', 'versioning', 10), scored('apis', 'rate-limiting', 10)];
  const links = selectResources(same, 4);
  assert.equal(new Set(links.map((link) => link.url)).size, links.length);
  assert.ok(links.length <= 4);
});

test('a strong session still gets useful links for its weakest areas', () => {
  const links = selectResources([scored('dsa', 'graphs', 88, 'Graphs'), scored('dsa', 'hashing', 92, 'Hashing')]);
  assert.ok(links.length > 0);
  assert.equal(links[0].reason, 'Graphs');
});

test('empty input gives no links instead of throwing', () => {
  assert.deepEqual(selectResources([]), []);
});
