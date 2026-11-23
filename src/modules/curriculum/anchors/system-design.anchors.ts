import { AnchorMap } from './anchor.types';

export const SYSTEM_DESIGN_ANCHORS: AnchorMap = {
  'requirements-estimation': {
    beginner: [
      'functional versus non-functional requirements with an example',
      'why you clarify requirements before drawing a design',
      'what throughput, latency and availability mean',
    ],
    intermediate: [
      'back-of-the-envelope estimate of requests per second, storage and bandwidth for a given service',
      'read-heavy versus write-heavy and how it changes the design',
      'turn "99.9% availability" into allowed downtime and what it implies',
    ],
    advanced: [
      'capacity plan with peak-to-average ratios and headroom, and where the first bottleneck appears',
      'trade off cost, latency and consistency for a stated SLO',
      'identify which requirement drives the architecture most and defend that call',
    ],
  },
  'scaling-basics': {
    beginner: [
      'vertical versus horizontal scaling',
      'what a load balancer does and why it is needed',
      'what a stateless service is and why it scales easily',
    ],
    intermediate: [
      'load balancing algorithms (round robin, least connections, hashing) and when each fits',
      'layer 4 versus layer 7 load balancers',
      'session handling when servers are behind a load balancer',
      'health checks and how a failed node is removed',
    ],
    advanced: [
      'autoscaling signals and the lag problem, plus how to avoid thrash',
      'avoid the load balancer being a single point of failure',
      'consistent hashing to spread load with minimal reshuffling',
    ],
  },
  'storage-choices': {
    beginner: [
      'when to choose a relational database versus a NoSQL database',
      'what a primary key and an index give you',
      'object storage versus a database for files',
    ],
    intermediate: [
      'pick storage for a given access pattern (key lookups, relations, time series, search)',
      'what you give up with NoSQL and what you gain',
      'polyglot persistence and the cost of running several stores',
    ],
    advanced: [
      'justify a storage choice using consistency, query flexibility, scale and operations',
      'migrate from one datastore to another with no downtime',
      'design the data layer for a workload that mixes OLTP and analytics',
    ],
  },
  'partitioning-replication': {
    beginner: [
      'what sharding is and why it is used',
      'what replication is and why it is used',
    ],
    intermediate: [
      'choosing a shard key and what makes a bad one (hot spots)',
      'leader-follower replication and replication lag effects on reads',
      'range versus hash partitioning trade-offs',
      'read replicas and read-your-writes problems',
    ],
    advanced: [
      'resharding a live system without downtime',
      'cross-shard queries and transactions and how to avoid them',
      'multi-leader versus leaderless replication and conflict resolution',
    ],
  },
  'caching-cdn': {
    beginner: [
      'why caching speeds up a system and what a cache hit is',
      'what a CDN is and what it caches',
      'what to cache and what not to',
    ],
    intermediate: [
      'cache-aside versus write-through, and the consistency risk of each',
      'where to place caches (client, CDN, application, database) and the trade-off',
      'cache invalidation: TTL versus explicit purge',
    ],
    advanced: [
      'prevent a cache stampede on a hot key',
      'keep cache and database consistent under concurrent writes',
      'design multi-layer caching for a global read-heavy product',
    ],
  },
  'async-messaging': {
    beginner: [
      'why use a message queue between services',
      'synchronous versus asynchronous communication',
    ],
    intermediate: [
      'queue versus publish-subscribe and when to pick each',
      'retries, dead-letter queues and idempotent consumers',
      'work that should be async, such as email, thumbnails and notifications',
    ],
    advanced: [
      'ordering, exactly-once claims and what you can guarantee',
      'event-driven design with the outbox pattern and failure recovery',
      'handle backpressure when consumers cannot keep up',
    ],
  },
  'consistency-availability': {
    beginner: [
      'what the CAP theorem says in plain terms',
      'strong versus eventual consistency with an example',
    ],
    intermediate: [
      'choose consistency or availability for a feature (bank balance versus like count)',
      'what a quorum is and how read and write quorums interact',
      'read-your-writes and monotonic reads',
    ],
    advanced: [
      'PACELC and the latency-consistency trade-off even without partitions',
      'conflict resolution with last-write-wins, vector clocks or CRDTs',
      'design a system that stays correct during a network partition',
    ],
  },
  'reliability-resilience': {
    beginner: [
      'what a single point of failure is and how to remove one',
      'what a timeout and a retry are for',
    ],
    intermediate: [
      'retries with exponential backoff and jitter, and why retries can make outages worse',
      'circuit breaker pattern and when it opens',
      'idempotency keys so retried requests are safe',
      'graceful degradation when a dependency fails',
    ],
    advanced: [
      'cascading failure and how bulkheads, load shedding and rate limits contain it',
      'multi-region failover, RPO and RTO, and their cost',
      'chaos testing and what steady state means',
    ],
  },
  observability: {
    beginner: [
      'logs, metrics and traces in one line each',
      'what to monitor on a web service',
    ],
    intermediate: [
      'the golden signals (latency, traffic, errors, saturation)',
      'alert on symptoms versus causes, and avoiding alert fatigue',
      'distributed tracing and correlation ids',
      'define an SLI and an SLO for a service',
    ],
    advanced: [
      'error budgets and how they guide release decisions',
      'find the cause of a latency regression across many services using telemetry',
      'cardinality and cost trade-offs of metrics and logs',
    ],
  },
  'classic-designs': {
    beginner: [
      'design a URL shortener: main components and data model',
      'design a simple key-value store at a high level',
    ],
    intermediate: [
      'URL shortener: id generation, collisions, redirects and caching',
      'design a rate limiter and the algorithm choice (token bucket, sliding window)',
      'design a notification system with queues and retries',
      'design a news feed: fan-out on write versus on read',
    ],
    advanced: [
      'design a chat system with delivery, ordering and presence at scale',
      'design a distributed rate limiter that is consistent across nodes',
      'design a search autocomplete or a video streaming pipeline and justify the trade-offs',
    ],
  },
};
