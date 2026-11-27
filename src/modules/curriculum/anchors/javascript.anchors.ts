import { AnchorMap } from './anchor.types';

export const JAVASCRIPT_ANCHORS: AnchorMap = {
  'scope-closures': {
    beginner: [
      'what a closure is, with a counter function that remembers its variable',
      'difference between var, let and const scope',
      'what lexical scope means',
      'what is hoisting for var and for function declarations',
    ],
    intermediate: [
      'the classic loop with setTimeout and var versus let, what prints and why',
      'use a closure for private state (module pattern) and what it protects',
      'what happens to a closure variable across multiple calls',
      'temporal dead zone for let and const',
    ],
    advanced: [
      'how a closure can keep large objects alive and cause a memory leak',
      'stale closures in callbacks or event handlers and how to avoid them',
      'implement once or memoize with a closure and discuss cache growth',
    ],
  },
  'this-prototypes': {
    beginner: [
      'what this refers to in a regular function versus a method call',
      'what a prototype is at the simplest level',
      'how an arrow function treats this',
    ],
    intermediate: [
      'losing this when passing a method as a callback and the fixes (bind, arrow)',
      'call, apply and bind and when each is used',
      'prototype chain lookup and how a method is found on an instance',
      'what new does step by step',
    ],
    advanced: [
      'class syntax versus prototypes: what class really compiles to',
      'implement your own bind or call',
      'Object.create, property shadowing and hasOwnProperty pitfalls',
    ],
  },
  'types-coercion': {
    beginner: [
      'difference between == and === with a surprising example',
      'the primitive types and what typeof returns for them',
      'truthy and falsy values',
      'why typeof null is "object"',
    ],
    intermediate: [
      'what [] + {} and [] == false produce and the coercion steps',
      'NaN behaviour and the right way to check for it',
      'pass by value versus pass by reference for primitives and objects',
      'Object.is versus ===',
    ],
    advanced: [
      'ToPrimitive and valueOf/toString/Symbol.toPrimitive in coercion',
      'floating point surprises such as 0.1 + 0.2 and safe handling of money',
      'BigInt versus Number and where mixing them fails',
    ],
  },
  'async-promises': {
    beginner: [
      'what a Promise is and its three states',
      'async and await as a way to write promise code',
      'callback versus promise for an async result',
      'what happens if a promise rejects and nobody handles it',
    ],
    intermediate: [
      'Promise.all versus allSettled versus race versus any',
      'sequential versus parallel awaits in a loop and the speed difference',
      'error handling with try/catch around await and with .catch',
      'order of output for a mix of promises and timers',
    ],
    advanced: [
      'implement Promise.all or a retry with backoff from scratch',
      'limit concurrency to N for a list of async tasks',
      'cancel an async operation (AbortController) and what cancellation cannot undo',
    ],
  },
  'event-loop': {
    beginner: [
      'why JavaScript is single threaded yet handles async work',
      'what the call stack and the callback queue are at a basic level',
      'what setTimeout with 0 really does',
    ],
    intermediate: [
      'microtasks versus macrotasks: order of promise then and setTimeout',
      'what blocks the event loop and how to avoid it with long loops',
      'predict the output of a snippet mixing sync code, promises and timers',
      'process.nextTick versus setImmediate versus promise callbacks',
    ],
    advanced: [
      'starving the event loop with endless microtasks and the effect on rendering or I/O',
      'break a long task into chunks and the trade-offs of each scheduling method',
      'compare the browser and Node event loop phases',
    ],
  },
  'modern-syntax-modules': {
    beginner: [
      'destructuring and spread with a short example',
      'arrow function versus regular function',
      'template literals and default parameters',
      'what import and export do',
    ],
    intermediate: [
      'named versus default exports and the trade-offs',
      'ES modules versus CommonJS differences (static imports, live bindings)',
      'optional chaining and nullish coalescing versus ||',
      'shallow versus deep copy with spread',
    ],
    advanced: [
      'circular imports in ES modules and what you observe',
      'dynamic import and code splitting, when it helps',
      'tree shaking and why side effects block it',
    ],
  },
  'memory-gc': {
    beginner: [
      'what garbage collection does in plain terms',
      'what makes an object eligible for collection',
      'a simple example of a memory leak, such as a forgotten global',
    ],
    intermediate: [
      'common leak sources: timers, listeners and closures not cleaned up',
      'WeakMap and WeakSet and when they help',
      'how to find a leak with heap snapshots, step by step',
    ],
    advanced: [
      'mark-and-sweep versus reference counting and cycles',
      'generational garbage collection and why short-lived objects are cheap',
      'diagnose a leak that only appears after many navigations',
    ],
  },
  'error-handling': {
    beginner: [
      'try, catch and finally and when finally runs',
      'what throw does and what to throw (an Error, not a string)',
      'what happens to an uncaught error',
    ],
    intermediate: [
      'catching errors in async code: why try/catch around a callback does not work',
      'creating custom error classes and why it helps',
      'unhandled promise rejections and how to detect them',
    ],
    advanced: [
      'design error handling across layers: wrap, rethrow, or translate errors',
      'error cause chaining and keeping the stack trace',
      'global handlers versus local handling and what is safe to do in them',
    ],
  },
  'functions-patterns': {
    beginner: [
      'what a higher-order function is, with map or filter',
      'difference between map, filter and reduce',
      'function declaration versus expression',
    ],
    intermediate: [
      'implement debounce and explain when to use it versus throttle',
      'currying and partial application with a use case',
      'pure functions and why they ease testing',
      'compose or pipe functions',
    ],
    advanced: [
      'implement throttle with leading and trailing options',
      'memoize with a cache key strategy for object arguments',
      'implement Promise-based pipelines or your own reduce',
    ],
  },
  'arrays-objects': {
    beginner: [
      'ways to loop over an array and when to use each',
      'how to copy an array or object and what shallow means',
      'which array methods mutate and which do not',
    ],
    intermediate: [
      'deep clone an object and the limits of JSON.parse(JSON.stringify())',
      'Map versus object and Set versus array for lookups',
      'remove duplicates from an array and the options',
      'Object.freeze and why it is shallow',
    ],
    advanced: [
      'immutable update patterns and their cost on large structures',
      'structuredClone and what it cannot copy',
      'sort stability, comparator pitfalls and how a bad comparator behaves',
    ],
  },
};
