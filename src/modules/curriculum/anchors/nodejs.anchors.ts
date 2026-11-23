import { AnchorMap } from './anchor.types';

export const NODEJS_ANCHORS: AnchorMap = {
  'runtime-event-loop': {
    beginner: [
      'why Node.js can serve many requests with a single thread',
      'what non-blocking I/O means',
      'difference between blocking and non-blocking code, with fs.readFileSync versus fs.readFile',
    ],
    intermediate: [
      'event loop phases (timers, poll, check) and where setImmediate fits',
      'process.nextTick versus promise microtasks versus setImmediate: order of output',
      'what the libuv thread pool is used for and its default size',
      'how a CPU-heavy loop affects every other request',
    ],
    advanced: [
      'diagnose an event loop stall in production: measure lag and find the blocking call',
      'which operations use the thread pool and how to tune UV_THREADPOOL_SIZE',
      'microtask starvation and how it differs from a blocked loop',
    ],
  },
  'modules-npm': {
    beginner: [
      'CommonJS require versus ES module import',
      'what package.json and node_modules are for',
      'dependencies versus devDependencies',
    ],
    intermediate: [
      'module caching: what happens when a file is required twice',
      'ESM versus CJS interop and the .mjs, .cjs and "type" field',
      'what a semver range such as ^1.2.3 allows and why a lockfile matters',
      'circular require and what you get',
    ],
    advanced: [
      'supply chain risks in npm and the practical defences (lockfile, audit, pinning, scripts)',
      'monorepo dependency hoisting and phantom dependencies',
      'package exports map and dual packages',
    ],
  },
  'streams-buffers': {
    beginner: [
      'why use a stream to send a large file instead of reading it all',
      'the four stream types in one line each',
      'what a Buffer is',
    ],
    intermediate: [
      'what backpressure is and how pipe or pipeline handles it',
      'pipeline versus pipe and error handling',
      'read a huge CSV line by line without loading it into memory',
      'objectMode streams and when to use them',
    ],
    advanced: [
      'implement a Transform stream and respect highWaterMark',
      'diagnose memory growth when a writable is slower than the source',
      'async iterators over streams and the cleanup trade-offs',
    ],
  },
  'http-middleware': {
    beginner: [
      'what middleware is in Express and the order in which it runs',
      'what req and res are and how to send JSON',
      'difference between app.use and a route handler',
    ],
    intermediate: [
      'error-handling middleware signature and where it must be placed',
      'why an unhandled async error in an Express handler can hang a request',
      'request validation and where to put it',
      'what happens if next is never called or called twice',
    ],
    advanced: [
      'timeouts, keep-alive and header limits on the HTTP server',
      'graceful shutdown: stop accepting, drain connections, then exit',
      'trade-offs between Express, Fastify and the raw http module',
    ],
  },
  'async-errors': {
    beginner: [
      'callbacks versus promises versus async/await in Node',
      'the error-first callback convention',
      'what happens when a promise is rejected and unhandled',
    ],
    intermediate: [
      'uncaughtException versus unhandledRejection and why you should not just log and continue',
      'sequential versus parallel async work with Promise.all',
      'convert a callback API with util.promisify',
      'retry with exponential backoff and jitter',
    ],
    advanced: [
      'structured error handling across services: operational versus programmer errors',
      'AsyncLocalStorage for request context and its cost',
      'backpressure and timeouts to stop a slow dependency cascading',
    ],
  },
  'scaling-processes': {
    beginner: [
      'why one Node process uses one CPU core for JavaScript',
      'what the cluster module does at a high level',
    ],
    intermediate: [
      'cluster versus worker_threads versus child_process: when to use which',
      'run Node behind a load balancer or process manager and why',
      'offload CPU-heavy work such as image resizing or hashing',
      'why in-memory state breaks when you run multiple processes',
    ],
    advanced: [
      'share data between worker threads (SharedArrayBuffer, transfer) and the hazards',
      'design a worker pool and handle crashes and queue growth',
      'sticky sessions, sockets and horizontal scaling of WebSockets',
    ],
  },
  'performance-debugging': {
    beginner: [
      'how to measure how long a piece of code takes',
      'what a memory leak looks like from the outside',
    ],
    intermediate: [
      'find a memory leak with heap snapshots, step by step',
      'profile CPU usage with --prof or the inspector and read a flame graph',
      'common leak sources: global caches, listeners, unclosed timers',
      'monitor event loop lag and what a high value means',
    ],
    advanced: [
      'latency spikes only under load: reason about GC pauses, the event loop and I/O saturation',
      'tune heap size and understand old-space growth and GC behaviour',
      'compare findings from tracing, logs and metrics in an incident',
    ],
  },
  'security-config': {
    beginner: [
      'why secrets should live in environment variables and not in code',
      'what input validation protects against',
      'what npm audit does',
    ],
    intermediate: [
      'prevent injection in queries and shell commands',
      'CORS: what it is and what it does not protect',
      'rate limiting and basic hardening (helmet-style headers)',
      'storing passwords with a slow hash such as bcrypt or argon2',
    ],
    advanced: [
      'prototype pollution and how it appears in Node apps',
      'ReDoS and how a regex can block the event loop',
      'manage configuration and secrets across environments safely',
    ],
  },
  'testing-deploy': {
    beginner: [
      'unit test versus integration test for an API',
      'what a mock is and when to use one',
    ],
    intermediate: [
      'test an Express API endpoint with supertest or the built-in test runner',
      'health checks and readiness probes for containers',
      'twelve-factor config and logs to stdout',
      'zero-downtime deploys and graceful shutdown handling',
    ],
    advanced: [
      'contract testing and test strategy for services',
      'container image practices for Node (multi-stage, non-root, signals, PID 1)',
      'observability: structured logs, metrics and traces for a Node service',
    ],
  },
};
