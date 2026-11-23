import { AnchorMap } from './anchor.types';

export const CONCURRENCY_ANCHORS: AnchorMap = {
  'processes-threads': {
    beginner: [
      'process versus thread',
      'what a context switch is and why it has a cost',
      'why use multiple threads',
    ],
    intermediate: [
      'thread pool and why not create a thread per task',
      'what scheduling and time slicing mean',
      'memory shared between threads versus separate between processes',
    ],
    advanced: [
      'cost model of threads (stack memory, context switches) versus event-driven I/O',
      'CPU-bound versus I/O-bound work and the right pool size for each',
      'thread starvation and priority inversion',
    ],
  },
  'race-conditions': {
    beginner: [
      'what a race condition is with a shared counter example',
      'why count++ is not atomic',
      'what a critical section is',
    ],
    intermediate: [
      'check-then-act races and how to remove them',
      'a race in a web request flow, such as overselling stock',
      'how to reproduce and detect a race in tests',
    ],
    advanced: [
      'memory visibility and reordering, and why synchronisation also affects visibility',
      'lost updates in read-modify-write and the options to prevent them',
      'data races versus race conditions and why the difference matters',
    ],
  },
  'locks-sync': {
    beginner: [
      'mutex versus semaphore',
      'what a lock protects and what happens if you forget to unlock',
    ],
    intermediate: [
      'read-write locks and when they help',
      'lock granularity: coarse versus fine and the trade-offs',
      'condition variables and the wait/notify pattern',
      'reentrant locks and why they exist',
    ],
    advanced: [
      'lock contention and ways to reduce it (sharding locks, lock-free approaches)',
      'spinlock versus blocking lock and when each is appropriate',
      'fairness and starvation with locks',
    ],
  },
  deadlocks: {
    beginner: [
      'what a deadlock is with a two-lock example',
      'the four conditions needed for a deadlock',
    ],
    intermediate: [
      'prevent deadlocks with a consistent lock order or timeouts',
      'deadlock versus livelock versus starvation',
      'how to find a deadlock in a running system with a thread dump',
    ],
    advanced: [
      'deadlock detection and recovery in databases',
      'distributed deadlocks across services and how timeouts help',
      'design a resource-acquisition scheme that cannot deadlock',
    ],
  },
  'async-vs-parallel': {
    beginner: [
      'concurrency versus parallelism with an everyday example',
      'what asynchronous I/O means',
    ],
    intermediate: [
      'when an event loop is enough and when you need threads or processes',
      'blocking calls inside async code and why they hurt',
      'async/await versus threads for I/O-bound services',
    ],
    advanced: [
      'compare event-loop, thread-per-request and actor models for a given load',
      'backpressure and bounded concurrency in async systems',
      'where parallel speed-ups stop (Amdahl) and what limits scaling',
    ],
  },
  'atomicity-locking': {
    beginner: [
      'what an atomic operation is',
      'what compare-and-swap does at a high level',
    ],
    intermediate: [
      'optimistic versus pessimistic locking with a version column',
      'atomic increments in a database or Redis versus read-modify-write',
      'a distributed lock with an expiry and why it can be unsafe',
      'the ABA problem in simple terms',
    ],
    advanced: [
      'fencing tokens and why a lease alone does not prevent a stale holder',
      'lock-free structures and their trade-offs',
      'coordinate a job so it runs on only one node, including failure of that node',
    ],
  },
  'concurrency-patterns': {
    beginner: [
      'what a producer-consumer problem is',
      'what a worker pool is',
    ],
    intermediate: [
      'a bounded blocking queue and what blocks when it is full or empty',
      'fan-out and fan-in with workers',
      'rate-limit or throttle concurrent calls with a semaphore',
      'graceful shutdown of workers',
    ],
    advanced: [
      'design a job scheduler with retries, ordering and no duplicates',
      'work stealing and load imbalance between workers',
      'actors or message passing versus shared-memory locking',
    ],
  },
};
