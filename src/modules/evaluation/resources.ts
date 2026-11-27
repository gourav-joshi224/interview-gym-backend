import { LearningResource } from '../../domain/session.types';

/**
 * Hand-picked reference material, mapped to each subtopic so a weak answer on closures points at closures,
 * not at a generic JavaScript page. Links are curated and checked on purpose: language models invent
 * plausible-looking URLs, so they are never asked to supply them. `npm run check:links` re-verifies them.
 */
const r = (title: string, url: string): LearningResource => ({ title, url });

const SD = 'https://github.com/donnemartin/system-design-primer';
const OSTEP = 'https://pages.cs.wisc.edu/~remzi/OSTEP';
const JSINFO = 'https://javascript.info';
const NODE = 'https://nodejs.org';
const MDN = 'https://developer.mozilla.org/en-US/docs/Web';
const PG = 'https://www.postgresql.org/docs/current';

export const SUBTOPIC_RESOURCES: Record<string, LearningResource[]> = {
  // DSA
  complexity: [r('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/'), r('Understanding time complexity with examples', 'https://www.geeksforgeeks.org/dsa/understanding-time-complexity-simple-examples/')],
  'arrays-strings': [r('Array data structure', 'https://www.geeksforgeeks.org/array-data-structure/'), r('NeetCode roadmap: arrays and hashing first', 'https://neetcode.io/roadmap')],
  hashing: [r('Hashing data structure', 'https://www.geeksforgeeks.org/hashing-data-structure/'), r('VisuAlgo: hash table', 'https://visualgo.net/en/hashtable')],
  'two-pointers-window': [r('Two pointers technique', 'https://www.geeksforgeeks.org/two-pointers-technique/'), r('Sliding window technique', 'https://www.geeksforgeeks.org/window-sliding-technique/')],
  'linked-lists': [r('VisuAlgo: linked list, stack and queue', 'https://visualgo.net/en/list'), r('Linked list data structure', 'https://www.geeksforgeeks.org/data-structures/linked-list/')],
  'stacks-queues': [r('Stack data structure', 'https://www.geeksforgeeks.org/stack-data-structure/'), r('VisuAlgo: stack and queue', 'https://visualgo.net/en/list')],
  'trees-bst': [r('VisuAlgo: binary search tree', 'https://visualgo.net/en/bst'), r('Binary search tree', 'https://www.geeksforgeeks.org/binary-search-tree-data-structure/')],
  heaps: [r('VisuAlgo: binary heap', 'https://visualgo.net/en/heap'), r('Heap data structure', 'https://www.geeksforgeeks.org/heap-data-structure/')],
  graphs: [r('VisuAlgo: graph traversal', 'https://visualgo.net/en/dfsbfs'), r('cp-algorithms: breadth-first search', 'https://cp-algorithms.com/graph/breadth-first-search.html')],
  'recursion-backtracking': [r('VisuAlgo: recursion tree', 'https://visualgo.net/en/recursion'), r('Backtracking algorithms', 'https://www.geeksforgeeks.org/backtracking-algorithms/')],
  'dynamic-programming': [r('cp-algorithms: introduction to dynamic programming', 'https://cp-algorithms.com/dynamic_programming/intro-to-dp.html'), r('Dynamic programming', 'https://www.geeksforgeeks.org/dynamic-programming/')],
  'sorting-searching': [r('VisuAlgo: sorting', 'https://visualgo.net/en/sorting'), r('cp-algorithms: binary search', 'https://cp-algorithms.com/num_methods/binary_search.html')],
  greedy: [r('Greedy algorithms', 'https://www.geeksforgeeks.org/greedy-algorithms/')],

  // JavaScript
  'scope-closures': [r('JavaScript.info: closure', `${JSINFO}/closure`), r('MDN: closures', `${MDN}/JavaScript/Closures`)],
  'this-prototypes': [r('JavaScript.info: object methods and this', `${JSINFO}/object-methods`), r('JavaScript.info: prototypal inheritance', `${JSINFO}/prototype-inheritance`)],
  'types-coercion': [r('JavaScript.info: type conversions', `${JSINFO}/type-conversions`), r('MDN: equality comparisons', `${MDN}/JavaScript/Equality_comparisons_and_sameness`)],
  'async-promises': [r('JavaScript.info: promise basics', `${JSINFO}/promise-basics`), r('JavaScript.info: async/await', `${JSINFO}/async-await`)],
  'event-loop': [r('JavaScript.info: event loop', `${JSINFO}/event-loop`), r('MDN: event loop', `${MDN}/JavaScript/Event_loop`)],
  'modern-syntax-modules': [r('JavaScript.info: modules', `${JSINFO}/modules-intro`), r('JavaScript.info: destructuring', `${JSINFO}/destructuring-assignment`)],
  'memory-gc': [r('JavaScript.info: garbage collection', `${JSINFO}/garbage-collection`), r('MDN: memory management', `${MDN}/JavaScript/Memory_management`)],
  'error-handling': [r('JavaScript.info: error handling', `${JSINFO}/error-handling`), r('MDN: control flow and error handling', `${MDN}/JavaScript/Guide/Control_flow_and_error_handling`)],
  'functions-patterns': [r('JavaScript.info: currying', `${JSINFO}/currying-partials`), r('JavaScript.info: decorators and forwarding', `${JSINFO}/call-apply-decorators`)],
  'arrays-objects': [r('JavaScript.info: array methods', `${JSINFO}/array-methods`), r('JavaScript.info: object copying', `${JSINFO}/object-copy`)],

  // Node.js
  'runtime-event-loop': [r('Node.js: event loop, timers and nextTick', `${NODE}/en/learn/asynchronous-work/event-loop-timers-and-nexttick`), r('Node.js: blocking versus non-blocking', `${NODE}/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking`)],
  'modules-npm': [r('Node.js: CommonJS modules', `${NODE}/api/modules.html`), r('Node.js: ECMAScript modules', `${NODE}/api/esm.html`)],
  'streams-buffers': [r('Node.js: backpressuring in streams', `${NODE}/en/learn/modules/backpressuring-in-streams`), r('Node.js: stream API', `${NODE}/api/stream.html`)],
  'http-middleware': [r('Express: using middleware', 'https://expressjs.com/en/guide/using-middleware.html'), r('Express: error handling', 'https://expressjs.com/en/guide/error-handling.html')],
  'async-errors': [r('Node.js: asynchronous flow control', `${NODE}/en/learn/asynchronous-work/asynchronous-flow-control`), r('Node.js: process events', `${NODE}/api/process.html`)],
  'scaling-processes': [r('Node.js: cluster', `${NODE}/api/cluster.html`), r('Node.js: worker threads', `${NODE}/api/worker_threads.html`)],
  'performance-debugging': [r('Node.js: memory diagnostics', `${NODE}/en/learn/diagnostics/memory`), r('Node.js: profiling', `${NODE}/en/learn/getting-started/profiling`)],
  'security-config': [r('Node.js: security best practices', `${NODE}/en/learn/getting-started/security-best-practices`), r('OWASP: Node.js security cheat sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html')],
  'testing-deploy': [r('Node.js: test runner', `${NODE}/api/test.html`), r('The Twelve-Factor App', 'https://12factor.net/')],

  // System design
  'requirements-estimation': [r('System Design Primer: back-of-the-envelope estimates', `${SD}#back-of-the-envelope-calculations`)],
  'scaling-basics': [r('System Design Primer: load balancer', `${SD}#load-balancer`), r('AWS: what is load balancing', 'https://aws.amazon.com/what-is/load-balancing/')],
  'storage-choices': [r('System Design Primer: SQL or NoSQL', `${SD}#sql-or-nosql`)],
  'partitioning-replication': [r('System Design Primer: sharding', `${SD}#sharding`), r('System Design Primer: replication', `${SD}#master-slave-replication`)],
  'caching-cdn': [r('System Design Primer: cache', `${SD}#cache`), r('System Design Primer: content delivery network', `${SD}#content-delivery-network`)],
  'async-messaging': [r('System Design Primer: asynchronism', `${SD}#asynchronism`)],
  'consistency-availability': [r('System Design Primer: consistency patterns', `${SD}#consistency-patterns`), r('System Design Primer: CAP theorem', `${SD}#cap-theorem`)],
  'reliability-resilience': [r('AWS Builders Library: timeouts, retries and backoff with jitter', 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/'), r('Google SRE book: addressing cascading failures', 'https://sre.google/sre-book/addressing-cascading-failures/')],
  observability: [r('Google SRE book: monitoring distributed systems', 'https://sre.google/sre-book/monitoring-distributed-systems/')],
  'classic-designs': [r('System Design Primer: interview questions with solutions', `${SD}#system-design-interview-questions-with-solutions`)],

  // Databases
  'sql-fundamentals': [r('SQLBolt: interactive SQL lessons', 'https://sqlbolt.com/'), r('PostgreSQL tutorial: joins', `${PG}/tutorial-join.html`)],
  indexing: [r('Use The Index, Luke', 'https://use-the-index-luke.com/'), r('PostgreSQL: indexes', `${PG}/indexes.html`)],
  'transactions-isolation': [r('PostgreSQL: transaction isolation', `${PG}/transaction-iso.html`), r('PostgreSQL: explicit locking', `${PG}/explicit-locking.html`)],
  'schema-normalization': [r('PostgreSQL: data definition', `${PG}/ddl.html`), r('Database normalization basics (Microsoft)', 'https://learn.microsoft.com/en-us/office/troubleshoot/access/database-normalization-description')],
  'nosql-models': [r('MongoDB: data modeling', 'https://www.mongodb.com/docs/manual/data-modeling/')],
  'replication-sharding': [r('PostgreSQL: high availability and replication', `${PG}/high-availability.html`), r('MongoDB: sharding', 'https://www.mongodb.com/docs/manual/sharding/')],
  operations: [r('PostgreSQL: backup and restore', `${PG}/backup.html`), r('HikariCP: about pool sizing', 'https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing')],

  // Caching
  'cache-patterns': [r('Azure: cache-aside pattern', 'https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside'), r('System Design Primer: cache', `${SD}#cache`)],
  'eviction-ttl': [r('Redis: key eviction', 'https://redis.io/docs/latest/develop/reference/eviction/')],
  'invalidation-consistency': [r('Azure: caching best practices', 'https://learn.microsoft.com/en-us/azure/architecture/best-practices/caching')],
  'stampede-hot-keys': [r('Wikipedia: cache stampede', 'https://en.wikipedia.org/wiki/Cache_stampede')],
  'distributed-caching': [r('Redis: data types', 'https://redis.io/docs/latest/develop/data-types/'), r('Redis: scaling with Redis Cluster', 'https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/')],
  'http-cdn-caching': [r('MDN: HTTP caching', `${MDN}/HTTP/Caching`), r('web.dev: prevent unnecessary network requests with the HTTP cache', 'https://web.dev/articles/http-cache')],

  // Queues
  'queue-basics': [r('RabbitMQ tutorial: hello world', 'https://www.rabbitmq.com/tutorials/tutorial-one-javascript'), r('AWS: what is a message queue', 'https://aws.amazon.com/message-queue/')],
  'delivery-semantics': [r('Kafka: message delivery semantics', 'https://kafka.apache.org/documentation/#semantics'), r('RabbitMQ: consumer acknowledgements and publisher confirms', 'https://www.rabbitmq.com/docs/confirms')],
  'retries-dlq': [r('RabbitMQ: dead letter exchanges', 'https://www.rabbitmq.com/docs/dlx'), r('AWS SQS: dead-letter queues', 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html')],
  'ordering-partitioning': [r('Kafka: topics and partitions', 'https://kafka.apache.org/documentation/#intro_concepts_and_terms')],
  'backpressure-scaling': [r('RabbitMQ: consumer prefetch', 'https://www.rabbitmq.com/docs/consumer-prefetch')],
  'logs-vs-queues': [r('Apache Kafka: introduction', 'https://kafka.apache.org/intro')],
  'outbox-sagas': [r('microservices.io: transactional outbox', 'https://microservices.io/patterns/data/transactional-outbox.html'), r('microservices.io: saga', 'https://microservices.io/patterns/data/saga.html')],

  // APIs
  'rest-http-basics': [r('MDN: HTTP overview', `${MDN}/HTTP/Overview`), r('MDN: HTTP request methods', `${MDN}/HTTP/Methods`)],
  'status-errors': [r('MDN: HTTP response status codes', `${MDN}/HTTP/Status`), r('RFC 9457: problem details for HTTP APIs', 'https://www.rfc-editor.org/rfc/rfc9457.html')],
  'authn-authz': [r('OWASP: authentication cheat sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html'), r('OAuth 2.0 overview', 'https://oauth.net/2/')],
  'idempotency-retries': [r('MDN: idempotent', 'https://developer.mozilla.org/en-US/docs/Glossary/Idempotent'), r('Stripe: idempotent requests', 'https://docs.stripe.com/api/idempotent_requests')],
  'pagination-filtering': [r('Use The Index, Luke: paging through results', 'https://use-the-index-luke.com/no-offset'), r('Azure: web API design best practices', 'https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design')],
  versioning: [r('Semantic Versioning', 'https://semver.org/'), r('Azure: web API design best practices', 'https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design')],
  'rate-limiting': [r('MDN: 429 Too Many Requests', `${MDN}/HTTP/Status/429`), r('Stripe: scaling your API with rate limiters', 'https://stripe.com/blog/rate-limiters')],
  'api-security': [r('OWASP API Security Top 10', 'https://owasp.org/API-Security/'), r('OWASP: REST security cheat sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html')],
  'graphql-grpc': [r('GraphQL: learn', 'https://graphql.org/learn/'), r('gRPC: introduction', 'https://grpc.io/docs/what-is-grpc/introduction/')],

  // Concurrency
  'processes-threads': [r('OSTEP: introduction to threads', `${OSTEP}/threads-intro.pdf`)],
  'race-conditions': [r('OSTEP: introduction to threads (races)', `${OSTEP}/threads-intro.pdf`), r('Wikipedia: race condition', 'https://en.wikipedia.org/wiki/Race_condition')],
  'locks-sync': [r('OSTEP: locks', `${OSTEP}/threads-locks.pdf`), r('OSTEP: semaphores', `${OSTEP}/threads-sema.pdf`)],
  deadlocks: [r('OSTEP: common concurrency problems', `${OSTEP}/threads-bugs.pdf`)],
  'async-vs-parallel': [r('Node.js: blocking versus non-blocking', `${NODE}/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking`), r('Go blog: concurrency is not parallelism', 'https://go.dev/blog/waza-talk')],
  'atomicity-locking': [r('Redis: distributed locks', 'https://redis.io/docs/latest/develop/use/patterns/distributed-locks/'), r('Kleppmann: how to do distributed locking', 'https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html')],
  'concurrency-patterns': [r('OSTEP: condition variables (producer-consumer)', `${OSTEP}/threads-cv.pdf`)],
};

/** Used when a subtopic has no links or a topic has no weak subtopic to point at. */
const TOPIC_RESOURCES: Record<string, LearningResource[]> = {
  dsa: [r('NeetCode roadmap', 'https://neetcode.io/roadmap'), r('VisuAlgo', 'https://visualgo.net/')],
  javascript: [r('The Modern JavaScript Tutorial', `${JSINFO}/`), r('MDN JavaScript guide', `${MDN}/JavaScript/Guide`)],
  nodejs: [r('Node.js Learn', `${NODE}/en/learn`), r('Node.js API documentation', `${NODE}/api/`)],
  'system-design': [r('System Design Primer', SD)],
  databases: [r('Use The Index, Luke', 'https://use-the-index-luke.com/'), r('PostgreSQL documentation', `${PG}/`)],
  caching: [r('Redis documentation', 'https://redis.io/docs/latest/'), r('MDN: HTTP caching', `${MDN}/HTTP/Caching`)],
  queues: [r('RabbitMQ tutorials', 'https://www.rabbitmq.com/tutorials'), r('Apache Kafka documentation', 'https://kafka.apache.org/documentation/')],
  apis: [r('MDN: HTTP', `${MDN}/HTTP`), r('OWASP API Security Top 10', 'https://owasp.org/API-Security/')],
  concurrency: [r('Operating Systems: Three Easy Pieces', `${OSTEP}/`)],
};

export function resourcesForTopic(topicId: string): LearningResource[] {
  return TOPIC_RESOURCES[topicId] ?? [];
}

export interface ScoredSubtopic {
  topicId: string;
  subtopicId: string;
  subtopic: string;
  /** Average question score for this subtopic, 0 to 100. */
  score: number;
}

const WEAK_BELOW = 70;
const MAX_RESOURCES = 6;

/**
 * Chooses study links from what the candidate actually got wrong: weakest subtopics first, a different set
 * for a Node.js gap than for a closures gap. Strong subtopics are only used to fill space, after the weak ones.
 */
export function selectResources(scored: ScoredSubtopic[], max = MAX_RESOURCES): LearningResource[] {
  const weakFirst = [...scored].sort((left, right) => left.score - right.score);
  const weak = weakFirst.filter((item) => item.score < WEAK_BELOW);
  const picked: LearningResource[] = [];
  const seen = new Set<string>();

  const add = (resource: LearningResource, reason: string) => {
    if (seen.has(resource.url) || picked.length >= max) return;
    seen.add(resource.url);
    picked.push({ ...resource, reason });
  };

  // One link per weak subtopic first so a long list of gaps is covered before any gets a second link.
  for (const item of weak) {
    const links = SUBTOPIC_RESOURCES[item.subtopicId];
    if (links?.[0]) add(links[0], item.subtopic);
  }
  for (const item of weak) {
    const links = SUBTOPIC_RESOURCES[item.subtopicId] ?? [];
    for (const link of links.slice(1)) add(link, item.subtopic);
  }

  // Nothing scored below the bar: point at the weakest areas anyway, they are the best next step.
  if (picked.length === 0) {
    for (const item of weakFirst.slice(0, 3)) {
      const links = SUBTOPIC_RESOURCES[item.subtopicId] ?? resourcesForTopic(item.topicId);
      if (links[0]) add(links[0], item.subtopic);
    }
  }

  // Subtopics with no curated links fall back to their topic's general reference.
  if (picked.length === 0) {
    for (const item of weakFirst) for (const link of resourcesForTopic(item.topicId)) add(link, item.subtopic);
  }
  return picked;
}
