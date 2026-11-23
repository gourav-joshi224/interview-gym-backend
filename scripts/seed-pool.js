/* Pre-fills the shared question pool. Costs Gemini calls, so start with --dry-run.
 *   npm run build && npm run seed:pool -- --dry-run
 *   npm run seed:pool -- --topic javascript --level beginner --target 6
 *   npm run seed:pool -- --topic javascript --subtopic scope-closures --level beginner --target 4
 */
require('dotenv').config({ path: '.env' });
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1] && !process.argv[at + 1].startsWith('--') ? process.argv[at + 1] : true;
};

(async () => {
  const { validateEnv } = require('../dist/config/env.config');
  validateEnv();
  const cfg = require('../dist/config/env.config').default();
  const config = { get: (path, def) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), cfg) ?? def };
  const { GeminiService } = require('../dist/modules/llm/gemini.service');
  const { StorageService } = require('../dist/modules/storage/storage.service');
  const { QuestionPoolService } = require('../dist/modules/questions/question-pool.service');
  const { QuestionGeneratorService } = require('../dist/modules/questions/question-generator.service');
  const { seedPool } = require('../dist/modules/questions/pool-seeder');

  const storage = new StorageService();
  const generator = new QuestionGeneratorService(new GeminiService(config), config, new QuestionPoolService(storage, config));
  const level = arg('level', undefined);
  const result = await seedPool(generator, storage, {
    topicId: arg('topic', undefined),
    subtopicId: arg('subtopic', undefined),
    levels: level ? String(level).split(',') : undefined,
    target: Number(arg('target', 6)),
    batch: Number(arg('batch', 6)),
    delayMs: Number(arg('delay', 5000)),
    dryRun: process.argv.includes('--dry-run'),
    log: (line) => console.log(line),
  });
  process.exit(result ? 0 : 1);
})().catch((error) => {
  console.error('seed failed:', error.message);
  process.exit(1);
});
