import { AnchorMap } from './anchor.types';

export const QUEUES_ANCHORS: AnchorMap = {
  'queue-basics': {
    beginner: [
      'what a message queue is and the roles of producer and consumer',
      'why decouple services with a queue',
      'synchronous call versus putting work on a queue',
    ],
    intermediate: [
      'point-to-point queue versus publish-subscribe',
      'which tasks belong on a queue (emails, thumbnails, billing) and which do not',
      'what a queue does to latency and to failure isolation',
    ],
    advanced: [
      'choose between a queue, a log and direct calls for a workflow, with the failure behaviour of each',
      'queue depth as a signal and what to do when it keeps growing',
    ],
  },
  'delivery-semantics': {
    beginner: [
      'at-most-once versus at-least-once delivery in simple terms',
      'what an acknowledgement is',
      'what happens when a consumer crashes before acknowledging',
    ],
    intermediate: [
      'why at-least-once delivery means duplicates and how an idempotent consumer handles them',
      'why exactly-once is hard and what systems actually offer',
      'ack before or after processing: the trade-off',
      'an idempotency key or deduplication table design',
    ],
    advanced: [
      'transactional processing and the effectively-once pattern (consume, process, produce)',
      'duplicate effects with external side effects such as sending an email twice',
      'offset commits and the gap between processing and committing',
    ],
  },
  'retries-dlq': {
    beginner: [
      'what a dead-letter queue is and why it exists',
      'why retry a failed message',
    ],
    intermediate: [
      'retry with backoff, and the poison message that never succeeds',
      'when to send a message to the DLQ and how to replay it safely',
      'transient versus permanent errors and how to tell them apart',
      'avoid a retry storm that hammers a recovering dependency',
    ],
    advanced: [
      'design retry topology with delay queues and separate retry tiers',
      'monitor and alert on the DLQ and handle a flood of dead letters',
      'preserve ordering when retrying messages',
    ],
  },
  'ordering-partitioning': {
    beginner: [
      'does a queue guarantee order, and when is order lost',
      'what a partition is',
    ],
    intermediate: [
      'ordering per key with partitioning and the cost of a hot partition',
      'what happens to ordering with several parallel consumers',
      'choosing a partition key for an order-sensitive workflow',
    ],
    advanced: [
      'preserve order across retries and rebalances',
      'repartitioning a live topic and its effect on ordering',
      'order versus throughput trade-offs for a stated workload',
    ],
  },
  'backpressure-scaling': {
    beginner: [
      'what happens when producers are faster than consumers',
      'how adding consumers helps',
    ],
    intermediate: [
      'prefetch or batch size and how it affects fairness and throughput',
      'scale consumers on queue depth or lag, and the limit of partition count',
      'bound a queue and decide what to do when it is full',
    ],
    advanced: [
      'consumer lag, rebalances and stop-the-world pauses in consumer groups',
      'protect a slow downstream with rate limiting or load shedding',
      'capacity plan for a queue-backed pipeline with spikes',
    ],
  },
  'logs-vs-queues': {
    beginner: [
      'difference between a queue and an event log in simple terms',
      'when you might use Kafka versus RabbitMQ',
    ],
    intermediate: [
      'consumer groups and offsets in Kafka versus acknowledgements in RabbitMQ',
      'log retention and replaying events',
      'routing with exchanges versus partitioned topics',
    ],
    advanced: [
      'log compaction and what it enables',
      'event sourcing and the cost of replay and schema evolution',
      'pick a broker for a given workload, citing ordering, replay, throughput and operations',
    ],
  },
  'outbox-sagas': {
    beginner: [
      'why updating a database and publishing a message can go wrong together',
    ],
    intermediate: [
      'transactional outbox pattern: how it fixes the dual write problem',
      'saga pattern versus a distributed transaction',
      'compensating actions and what makes one safe',
      'idempotent handlers in a saga',
    ],
    advanced: [
      'orchestration versus choreography for sagas and their failure modes',
      'out-of-order or late events in a saga and how to handle them',
      'change data capture to publish the outbox and its operational risks',
    ],
  },
};
