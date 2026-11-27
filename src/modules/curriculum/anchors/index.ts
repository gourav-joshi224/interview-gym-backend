import { Level } from '../../../domain/levels';
import { AnchorMap } from './anchor.types';
import { APIS_ANCHORS } from './apis.anchors';
import { CACHING_ANCHORS } from './caching.anchors';
import { CONCURRENCY_ANCHORS } from './concurrency.anchors';
import { DATABASES_ANCHORS } from './databases.anchors';
import { DSA_ANCHORS } from './dsa.anchors';
import { JAVASCRIPT_ANCHORS } from './javascript.anchors';
import { NODEJS_ANCHORS } from './nodejs.anchors';
import { QUEUES_ANCHORS } from './queues.anchors';
import { SYSTEM_DESIGN_ANCHORS } from './system-design.anchors';

/** Subtopic ids are unique across topics, so one flat map is enough. */
export const ANCHORS: AnchorMap = {
  ...DSA_ANCHORS,
  ...JAVASCRIPT_ANCHORS,
  ...NODEJS_ANCHORS,
  ...SYSTEM_DESIGN_ANCHORS,
  ...DATABASES_ANCHORS,
  ...CACHING_ANCHORS,
  ...QUEUES_ANCHORS,
  ...APIS_ANCHORS,
  ...CONCURRENCY_ANCHORS,
};

/**
 * Picks up to `count` anchors for a subtopic at a level. When the level has none, it falls back to the nearest
 * lower level (an explicit subtopic choice can sit above the session level), so a slot always has something real to build on.
 */
export function pickAnchors(
  subtopicId: string | null,
  level: Level,
  count = 2,
  rng: () => number = Math.random,
  /** Anchors already given to other slots in the same session, so two questions never cover the same ground. */
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  if (!subtopicId) return [];
  const entry = ANCHORS[subtopicId];
  if (!entry) return [];
  const order: Level[] = level === 'advanced' ? ['advanced', 'intermediate', 'beginner'] : level === 'intermediate' ? ['intermediate', 'beginner'] : ['beginner'];
  const pool = order.map((candidate) => entry[candidate]).find((list) => list.length > 0) ?? [];
  const fresh = pool.filter((text) => !exclude.has(text));
  const shuffled = [...(fresh.length >= count ? fresh : pool)];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
