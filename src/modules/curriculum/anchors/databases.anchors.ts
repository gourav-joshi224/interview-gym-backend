import { AnchorMap } from './anchor.types';

export const DATABASES_ANCHORS: AnchorMap = {
  'sql-fundamentals': {
    beginner: [
      'inner join versus left join with a small example',
      'primary key versus foreign key versus unique constraint',
      'WHERE versus HAVING',
      'what GROUP BY does with COUNT or SUM',
    ],
    intermediate: [
      'the LEFT JOIN filter trap: a WHERE on the right table turning it into an inner join',
      'NULL handling and why NOT IN with a NULL returns nothing',
      'window functions such as ROW_NUMBER, RANK and running totals',
      'subquery versus CTE and when each reads better',
    ],
    advanced: [
      'rewrite a correlated subquery for performance',
      'top N per group and the options (window function, lateral join)',
      'recursive CTEs for hierarchies',
    ],
  },
  indexing: {
    beginner: [
      'what an index is and how it speeds up a query',
      'why indexes make writes slower',
      'which columns are good candidates for an index',
    ],
    intermediate: [
      'composite index column order and the leftmost-prefix rule',
      'why a query ignores an index (function on the column, low selectivity, type mismatch)',
      'covering index and what it avoids',
      'reading EXPLAIN output to spot a sequential scan',
    ],
    advanced: [
      'B-tree versus hash versus GIN or full-text index and what each suits',
      'index bloat, partial indexes and write amplification',
      'a query that jumped from 40ms to 4s: a systematic diagnosis',
    ],
  },
  'transactions-isolation': {
    beginner: [
      'what ACID stands for with a bank transfer example',
      'what a transaction, commit and rollback are',
    ],
    intermediate: [
      'dirty read, non-repeatable read and phantom read and the isolation level that prevents each',
      'what a deadlock is in a database and how it is resolved',
      'pessimistic locking (SELECT FOR UPDATE) versus optimistic locking',
      'read committed versus repeatable read in practice',
    ],
    advanced: [
      'snapshot isolation (MVCC) and the write skew anomaly',
      'prevent double spending or overselling under concurrent requests',
      'long-running transactions and their effect on vacuum or locks',
    ],
  },
  'schema-normalization': {
    beginner: [
      'what normalisation is and why it reduces redundancy',
      'first, second and third normal form in simple terms',
      'one-to-many versus many-to-many and how each is modelled',
    ],
    intermediate: [
      'when to denormalise deliberately and the cost',
      'modelling a many-to-many relationship with a join table',
      'choosing a primary key: natural versus surrogate, UUID versus integer',
      'soft delete versus hard delete trade-offs',
    ],
    advanced: [
      'schema design for multi-tenancy and the isolation trade-offs',
      'zero-downtime schema changes on a large table',
      'model history and audit trails or time-versioned data',
    ],
  },
  'nosql-models': {
    beginner: [
      'document, key-value, column and graph databases in one line each',
      'when a document store fits better than tables',
    ],
    intermediate: [
      'design a document schema: embed versus reference',
      'why you model NoSQL around queries and not around entities',
      'what you give up (joins, transactions) and how to cope',
    ],
    advanced: [
      'partition key design for a wide-column store and hot partitions',
      'consistency levels in a tunable store and what each means for reads',
      'choose between a document store and a relational database for a given product',
    ],
  },
  'replication-sharding': {
    beginner: [
      'why a database is replicated',
      'what sharding is and what it solves',
    ],
    intermediate: [
      'synchronous versus asynchronous replication and the durability trade-off',
      'replication lag and a stale read after a write',
      'shard key choice and rebalancing',
      'what a failover involves',
    ],
    advanced: [
      'split-brain and how consensus or fencing avoids it',
      'cross-shard joins and transactions: why they are hard',
      'plan a migration from a single database to shards with minimal downtime',
    ],
  },
  operations: {
    beginner: [
      'what a connection pool is and why it helps',
      'why backups matter and what a restore test proves',
    ],
    intermediate: [
      'pool sizing and what happens when the pool is exhausted',
      'point-in-time recovery and how it differs from a snapshot',
      'running a migration safely in production',
      'finding slow queries with logs or statistics',
    ],
    advanced: [
      'connection storms and the role of a pooler such as PgBouncer',
      'plan RPO and RTO for a database and how backups meet them',
      'online schema change without locking a big table',
    ],
  },
};
