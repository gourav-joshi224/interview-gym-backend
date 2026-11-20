export type QuestionType =
  | 'concept'
  | 'scenario'
  | 'debugging'
  | 'design'
  | 'tradeoff'
  | 'coding';

export interface Subtopic {
  id: string;
  label: string;
}

export interface TopicDef {
  id: string;
  label: string;
  description: string;
  /** Whether short code snippets make sense in questions for this topic. */
  supportsCode: boolean;
  subtopics: Subtopic[];
}

export const TOPICS: TopicDef[] = [
  {
    id: 'dsa',
    label: 'DSA',
    description: 'Data structures, algorithms, complexity and problem-solving approach.',
    supportsCode: true,
    subtopics: [
      { id: 'complexity', label: 'Complexity analysis (Big-O)' },
      { id: 'arrays-strings', label: 'Arrays & strings' },
      { id: 'hashing', label: 'Hash maps & sets' },
      { id: 'two-pointers-window', label: 'Two pointers & sliding window' },
      { id: 'linked-lists', label: 'Linked lists' },
      { id: 'stacks-queues', label: 'Stacks & queues' },
      { id: 'trees-bst', label: 'Trees & binary search trees' },
      { id: 'heaps', label: 'Heaps & priority queues' },
      { id: 'graphs', label: 'Graphs: BFS, DFS, shortest paths' },
      { id: 'recursion-backtracking', label: 'Recursion & backtracking' },
      { id: 'dynamic-programming', label: 'Dynamic programming' },
      { id: 'sorting-searching', label: 'Sorting & binary search' },
      { id: 'greedy', label: 'Greedy algorithms' },
    ],
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    description: 'Language fundamentals, async behaviour and runtime semantics.',
    supportsCode: true,
    subtopics: [
      { id: 'scope-closures', label: 'Scope & closures' },
      { id: 'this-prototypes', label: '`this` binding & prototypes' },
      { id: 'types-coercion', label: 'Types, coercion & equality' },
      { id: 'async-promises', label: 'Promises & async/await' },
      { id: 'event-loop', label: 'Event loop & microtasks' },
      { id: 'modern-syntax-modules', label: 'Modern syntax & modules' },
      { id: 'memory-gc', label: 'Memory & garbage collection' },
      { id: 'error-handling', label: 'Error handling' },
      { id: 'functions-patterns', label: 'Functions & higher-order patterns' },
      { id: 'arrays-objects', label: 'Arrays, objects & immutability' },
    ],
  },
  {
    id: 'nodejs',
    label: 'Node.js',
    description: 'Runtime internals, streams, servers and backend performance.',
    supportsCode: true,
    subtopics: [
      { id: 'runtime-event-loop', label: 'Runtime & event loop' },
      { id: 'modules-npm', label: 'Modules (CJS/ESM) & npm' },
      { id: 'streams-buffers', label: 'Streams & buffers' },
      { id: 'http-middleware', label: 'HTTP servers & middleware' },
      { id: 'async-errors', label: 'Async patterns & error handling' },
      { id: 'scaling-processes', label: 'Cluster, worker threads & scaling' },
      { id: 'performance-debugging', label: 'Performance & memory debugging' },
      { id: 'security-config', label: 'Security & configuration' },
      { id: 'testing-deploy', label: 'Testing & deployment' },
    ],
  },
  {
    id: 'system-design',
    label: 'System Design',
    description: 'Architecture, scaling and trade-offs for real products.',
    supportsCode: false,
    subtopics: [
      { id: 'requirements-estimation', label: 'Requirements & capacity estimation' },
      { id: 'scaling-basics', label: 'Load balancing & horizontal scaling' },
      { id: 'storage-choices', label: 'Choosing storage (SQL vs NoSQL)' },
      { id: 'partitioning-replication', label: 'Sharding & replication' },
      { id: 'caching-cdn', label: 'Caching & CDNs' },
      { id: 'async-messaging', label: 'Async processing & messaging' },
      { id: 'consistency-availability', label: 'Consistency, availability & CAP' },
      { id: 'reliability-resilience', label: 'Reliability, retries & failure handling' },
      { id: 'observability', label: 'Monitoring & observability' },
      { id: 'classic-designs', label: 'Classic designs (URL shortener, feed, chat)' },
    ],
  },
  {
    id: 'databases',
    label: 'Databases',
    description: 'Schema design, indexing, transactions and scaling.',
    supportsCode: false,
    subtopics: [
      { id: 'sql-fundamentals', label: 'SQL & relational modeling' },
      { id: 'indexing', label: 'Indexes & query performance' },
      { id: 'transactions-isolation', label: 'Transactions & isolation levels' },
      { id: 'schema-normalization', label: 'Schema design & normalization' },
      { id: 'nosql-models', label: 'NoSQL data models' },
      { id: 'replication-sharding', label: 'Replication & sharding' },
      { id: 'operations', label: 'Connection pooling, migrations & backups' },
    ],
  },
  {
    id: 'caching',
    label: 'Caching',
    description: 'Cache patterns, invalidation and failure modes.',
    supportsCode: false,
    subtopics: [
      { id: 'cache-patterns', label: 'Caching patterns (cache-aside, write-through)' },
      { id: 'eviction-ttl', label: 'Eviction policies & TTL' },
      { id: 'invalidation-consistency', label: 'Invalidation & consistency' },
      { id: 'stampede-hot-keys', label: 'Cache stampede & hot keys' },
      { id: 'distributed-caching', label: 'Redis & distributed caches' },
      { id: 'http-cdn-caching', label: 'HTTP caching & CDN' },
    ],
  },
  {
    id: 'queues',
    label: 'Queues',
    description: 'Async jobs, delivery guarantees and message ordering.',
    supportsCode: false,
    subtopics: [
      { id: 'queue-basics', label: 'Queue fundamentals & use cases' },
      { id: 'delivery-semantics', label: 'Delivery guarantees & idempotency' },
      { id: 'retries-dlq', label: 'Retries & dead-letter queues' },
      { id: 'ordering-partitioning', label: 'Ordering & partitioning' },
      { id: 'backpressure-scaling', label: 'Backpressure & consumer scaling' },
      { id: 'logs-vs-queues', label: 'Event logs (Kafka-style) vs queues' },
      { id: 'outbox-sagas', label: 'Outbox pattern & sagas' },
    ],
  },
  {
    id: 'apis',
    label: 'APIs',
    description: 'REST design, auth, pagination, versioning and security.',
    supportsCode: false,
    subtopics: [
      { id: 'rest-http-basics', label: 'REST & HTTP fundamentals' },
      { id: 'status-errors', label: 'Status codes & error handling' },
      { id: 'authn-authz', label: 'Authentication & authorization' },
      { id: 'idempotency-retries', label: 'Idempotency & safe retries' },
      { id: 'pagination-filtering', label: 'Pagination & filtering' },
      { id: 'versioning', label: 'Versioning & backward compatibility' },
      { id: 'rate-limiting', label: 'Rate limiting & throttling' },
      { id: 'api-security', label: 'API security' },
      { id: 'graphql-grpc', label: 'GraphQL & gRPC basics' },
    ],
  },
  {
    id: 'concurrency',
    label: 'Concurrency',
    description: 'Threads, races, locks and consistency under parallel load.',
    supportsCode: false,
    subtopics: [
      { id: 'processes-threads', label: 'Processes, threads & scheduling' },
      { id: 'race-conditions', label: 'Race conditions & critical sections' },
      { id: 'locks-sync', label: 'Locks & synchronization primitives' },
      { id: 'deadlocks', label: 'Deadlocks & liveness' },
      { id: 'async-vs-parallel', label: 'Concurrency vs parallelism & async I/O' },
      { id: 'atomicity-locking', label: 'Atomic operations, optimistic locking & distributed locks' },
      { id: 'concurrency-patterns', label: 'Patterns (worker pool, producer-consumer)' },
    ],
  },
];

const BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));
const BY_LOOKUP = new Map<string, TopicDef>();
for (const topic of TOPICS) {
  BY_LOOKUP.set(topic.id, topic);
  BY_LOOKUP.set(topic.label.toLowerCase(), topic);
}
// Spellings used by older clients and stored sessions.
BY_LOOKUP.set('node.js', BY_ID.get('nodejs') as TopicDef);
BY_LOOKUP.set('system_design', BY_ID.get('system-design') as TopicDef);
BY_LOOKUP.set('data structures and algorithms', BY_ID.get('dsa') as TopicDef);

export function findTopic(value: string | null | undefined): TopicDef | null {
  if (!value) return null;
  return BY_LOOKUP.get(value.trim().toLowerCase()) ?? null;
}

export function getTopicOrThrow(id: string): TopicDef {
  const topic = BY_ID.get(id);
  if (!topic) throw new Error(`Unknown topic id: ${id}`);
  return topic;
}

export function subtopicLabel(topic: TopicDef, subtopicId: string): string {
  return topic.subtopics.find((subtopic) => subtopic.id === subtopicId)?.label ?? subtopicId;
}
