import { LearningResource } from '../../domain/session.types';

/**
 * Hand-picked, stable reference material per topic. Links are curated on purpose:
 * language models invent plausible-looking URLs, so they are never asked to supply them.
 */
const RESOURCES: Record<string, LearningResource[]> = {
  dsa: [
    { title: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com/' },
    { title: 'VisuAlgo: visualise data structures and algorithms', url: 'https://visualgo.net/' },
    { title: 'Algorithms for Competitive Programming (cp-algorithms)', url: 'https://cp-algorithms.com/' },
  ],
  javascript: [
    { title: 'The Modern JavaScript Tutorial', url: 'https://javascript.info/' },
    { title: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
  ],
  nodejs: [
    { title: 'Node.js Learn', url: 'https://nodejs.org/en/learn' },
    { title: 'Node.js API documentation', url: 'https://nodejs.org/api/' },
  ],
  'system-design': [
    { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { title: 'Designing Data-Intensive Applications (book site)', url: 'https://dataintensive.net/' },
  ],
  databases: [
    { title: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/' },
    { title: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/' },
  ],
  caching: [
    { title: 'Redis documentation', url: 'https://redis.io/docs/latest/' },
    { title: 'MDN: HTTP caching', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching' },
  ],
  queues: [
    { title: 'RabbitMQ tutorials', url: 'https://www.rabbitmq.com/tutorials' },
    { title: 'Apache Kafka documentation', url: 'https://kafka.apache.org/documentation/' },
  ],
  apis: [
    { title: 'MDN: HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP' },
    { title: 'OWASP API Security Top 10', url: 'https://owasp.org/API-Security/' },
  ],
  concurrency: [
    { title: 'Operating Systems: Three Easy Pieces (concurrency)', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/' },
  ],
};

export function resourcesForTopic(topicId: string): LearningResource[] {
  return RESOURCES[topicId] ?? [];
}
