import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiUnavailableError, GeminiService } from '../src/modules/llm/gemini.service';
import { fakeConfig } from './helpers';

type Behaviour = 'ok' | 'overload' | 'quota' | 'bad-request' | 'bad-json' | 'empty';
const failure = (status: number, message: string) => Object.assign(new Error(message), { status });

/** Builds a service whose Gemini client behaves per model, and records every call. */
function build(behaviour: Record<string, Behaviour | Behaviour[]>, fallback: string[] = []) {
  const calls: string[] = [];
  const counters = new Map<string, number>();
  const service = new GeminiService(fakeConfig({ 'gemini.backoffMs': 1, 'gemini.timeoutMs': 5000 }) as never);
  (service as unknown as { client: unknown }).client = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        calls.push(model);
        const n = counters.get(model) ?? 0;
        counters.set(model, n + 1);
        const plan = behaviour[model];
        const step = Array.isArray(plan) ? (plan[Math.min(n, plan.length - 1)] ?? 'ok') : (plan ?? 'ok');
        if (step === 'overload') throw failure(503, 'high demand');
        if (step === 'quota') throw failure(429, 'quota exceeded');
        if (step === 'bad-request') throw failure(400, 'invalid argument');
        if (step === 'bad-json') return { text: '{not json' };
        if (step === 'empty') return { text: '  ' };
        return { text: JSON.stringify({ from: model }) };
      },
    },
  };
  const run = (primary = 'big', models: string[] = fallback) =>
    service.generateJson<{ from: string }>({ model: primary, fallbackModels: models, system: 's', prompt: 'p', schema: {} });
  return { service, run, calls };
}

test('uses the primary model when it is healthy', async () => {
  const { run, calls } = build({}, ['lite']);
  assert.equal((await run()).from, 'big');
  assert.deepEqual(calls, ['big']);
});

test('falls back to the next model when the primary is overloaded', async () => {
  const { run, calls } = build({ big: 'overload' }, ['lite']);
  assert.equal((await run()).from, 'lite');
  assert.deepEqual(calls, ['big', 'lite']);
});

test('falls back on quota errors too', async () => {
  const { run } = build({ big: 'quota' }, ['lite']);
  assert.equal((await run()).from, 'lite');
});

test('an overloaded model is skipped on the next request instead of waited on again', async () => {
  const { run, calls } = build({ big: 'overload' }, ['lite']);
  await run();
  calls.length = 0;
  assert.equal((await run()).from, 'lite');
  assert.deepEqual(calls, ['lite']);
});

test('a bad request is not retried but still tries the next model', async () => {
  const { run, calls } = build({ big: 'bad-request' }, ['lite']);
  assert.equal((await run()).from, 'lite');
  assert.deepEqual(calls, ['big', 'lite']);
});

test('a bad request does not put the model on cooldown', async () => {
  const { run, calls } = build({ big: ['bad-request', 'ok'] }, ['lite']);
  await run();
  calls.length = 0;
  assert.equal((await run()).from, 'big');
  assert.deepEqual(calls, ['big']);
});

test('retries malformed output on the last-resort model', async () => {
  const { run, calls } = build({ big: ['bad-json', 'ok'] });
  assert.equal((await run()).from, 'big');
  assert.deepEqual(calls, ['big', 'big']);
});

test('does not retry a busy primary at all when a fallback exists', async () => {
  const { run, calls } = build({ big: 'overload' }, ['lite']);
  await run();
  assert.equal(calls.filter((model) => model === 'big').length, 1);
});

test('retries the last-resort fallback when it is flaky', async () => {
  const { run, calls } = build({ big: 'overload', lite: ['bad-json', 'ok'] }, ['lite']);
  assert.equal((await run()).from, 'lite');
  assert.deepEqual(calls, ['big', 'lite', 'lite']);
});

test('empty output is retried, and a single model gets three attempts', async () => {
  const { run, calls } = build({ big: ['empty', 'empty', 'ok'] });
  assert.equal((await run()).from, 'big');
  assert.equal(calls.length, 3);
});

test('reports AI_UNAVAILABLE when every model fails', async () => {
  const { run, calls } = build({ big: 'overload', lite: 'overload' }, ['lite']);
  await assert.rejects(run(), (error: unknown) => error instanceof AiUnavailableError && error.code === 'AI_UNAVAILABLE');
  assert.deepEqual(calls, ['big', 'lite', 'lite', 'lite']);
});

test('still tries when every model is cooling down rather than failing without a call', async () => {
  const { run, calls } = build({ big: 'overload', lite: 'overload' }, ['lite']);
  await assert.rejects(run());
  calls.length = 0;
  await assert.rejects(run());
  assert.ok(calls.length > 0);
});

test('ignores duplicate or blank fallback entries', async () => {
  const { run, calls } = build({ big: 'overload' }, ['big', '', 'lite']);
  await run();
  assert.deepEqual(calls, ['big', 'lite']);
});

test('refuses to run without an API key', async () => {
  const service = new GeminiService(fakeConfig({ 'gemini.apiKey': '' }) as never);
  await assert.rejects(
    service.generateJson({ model: 'big', system: 's', prompt: 'p', schema: {} }),
    (error: unknown) => error instanceof AiUnavailableError && error.code === 'AI_NOT_CONFIGURED',
  );
});
