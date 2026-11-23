import { AnchorMap } from './anchor.types';

export const CACHING_ANCHORS: AnchorMap = {
  'cache-patterns': {
    beginner: [
      'what a cache is and why it speeds things up',
      'cache hit versus cache miss and hit ratio',
      'cache-aside in plain steps: check the cache, read the database, store the result',
    ],
    intermediate: [
      'cache-aside versus read-through versus write-through versus write-back and their trade-offs',
      'what data is a good caching candidate',
      'write-around and when it helps',
      'what happens to reads and writes when the cache is cold',
    ],
    advanced: [
      'write-back risks: data loss window and ordering',
      'choose a caching pattern for a workload and justify it under failure',
      'a read-heavy product where the cache hides a slow database: what breaks when the cache is lost',
    ],
  },
  'eviction-ttl': {
    beginner: [
      'what TTL is and why entries expire',
      'what LRU eviction means',
    ],
    intermediate: [
      'LRU versus LFU and when each wins',
      'how TTL and a full cache are independent reasons for removal',
      'choosing a TTL for data that changes at different rates',
      'implement an LRU cache and its structures',
    ],
    advanced: [
      'approximated LRU in Redis and why exact LRU is costly',
      'one-hit wonders and admission policies (TinyLFU)',
      'memory sizing and eviction pressure, and how to see it in metrics',
    ],
  },
  'invalidation-consistency': {
    beginner: [
      'what cache invalidation means and why it is hard',
      'what happens if you update the database but not the cache',
    ],
    intermediate: [
      'delete versus update the cache on a write and the race it creates',
      'stale data and acceptable staleness for a feature',
      'event-based invalidation versus TTL-only',
      'versioned or namespaced keys to invalidate groups of entries',
    ],
    advanced: [
      'a race between a read filling the cache and a concurrent write, and how to prevent it',
      'invalidation across regions or many cache nodes',
      'bound staleness with leases, versions or change data capture',
    ],
  },
  'stampede-hot-keys': {
    beginner: [
      'what a cache stampede is in simple words',
      'what a hot key is',
    ],
    intermediate: [
      'mitigate a stampede: request coalescing, locks, jittered TTL, stale-while-revalidate',
      'cache penetration (lookups for missing keys) and a null cache or bloom filter',
      'cache avalanche from many keys expiring together',
      'handle a hot key that overloads one cache node',
    ],
    advanced: [
      'protect the database when the whole cache restarts cold',
      'replicate or locally cache hot keys and its consistency cost',
      'design load shedding so a cache failure does not become a total outage',
    ],
  },
  'distributed-caching': {
    beginner: [
      'what Redis is and what it is commonly used for',
      'why use a shared cache instead of a per-server cache',
    ],
    intermediate: [
      'choosing Redis data structures (string, hash, sorted set, list) for a use case',
      'consistent hashing and how a cluster shards keys',
      'Redis persistence (RDB versus AOF) and what is lost on restart',
      'a distributed lock or rate limiter with Redis and its caveats',
    ],
    advanced: [
      'Redis Cluster slots, resharding and multi-key limits',
      'replication, failover and what happens to writes during a failover',
      'big keys and slow commands that block a single-threaded server',
    ],
  },
  'http-cdn-caching': {
    beginner: [
      'what a CDN does and why it reduces latency',
      'what Cache-Control max-age means',
    ],
    intermediate: [
      'ETag and If-None-Match, and a 304 response',
      'public versus private caching and what must never be cached publicly',
      'cache busting for static assets with fingerprinted file names',
      'stale-while-revalidate for HTTP',
    ],
    advanced: [
      'cache keys, Vary headers and cache fragmentation',
      'purge strategies and surrogate keys on a CDN',
      'cache dynamic API responses at the edge safely',
    ],
  },
};
