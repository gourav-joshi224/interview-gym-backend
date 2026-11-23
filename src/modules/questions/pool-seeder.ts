import { LEVELS, Level } from '../../domain/levels';
import { TOPICS, TopicDef } from '../curriculum/curriculum.data';
import { QUESTION_PROMPT_VERSION } from './question-prompts';
import { QuestionGeneratorService } from './question-generator.service';
import { StorageService } from '../storage/storage.service';

export interface SeedOptions {
  /** Limit to one topic id. Defaults to every topic. */
  topicId?: string;
  /** Limit to one subtopic id (useful for a targeted refill). */
  subtopicId?: string;
  /** Limit to some levels. Defaults to all three. */
  levels?: Level[];
  /** Fill each subtopic and level up to this many pooled questions. */
  target: number;
  /** Most questions requested in one generation call. */
  batch: number;
  /** Pause between calls so a free-tier key stays under its rate limit. */
  delayMs: number;
  dryRun: boolean;
  log: (line: string) => void;
}

export interface SeedJob {
  topic: TopicDef;
  subtopicId: string;
  subtopicLabel: string;
  level: Level;
  existing: string[];
  need: number;
}

/** Works out what is missing from the pool. Reads only, so it is also what a dry run prints. */
export async function planSeed(storage: StorageService, options: Pick<SeedOptions, 'topicId' | 'subtopicId' | 'levels' | 'target'>): Promise<SeedJob[]> {
  const topics = options.topicId ? TOPICS.filter((topic) => topic.id === options.topicId) : TOPICS;
  if (topics.length === 0) throw new Error(`Unknown topic "${options.topicId}". Known: ${TOPICS.map((topic) => topic.id).join(', ')}`);
  const jobs: SeedJob[] = [];
  for (const topic of topics) {
    for (const subtopic of topic.subtopics) {
      if (options.subtopicId && subtopic.id !== options.subtopicId) continue;
      for (const level of options.levels ?? [...LEVELS]) {
        // Mirror the planner: a subtopic is not asked automatically below its minimum level.
        if (LEVELS.indexOf(level) < LEVELS.indexOf(subtopic.minLevel ?? 'beginner')) continue;
        const existing = await storage.poolCandidates(subtopic.id, level, QUESTION_PROMPT_VERSION, 200);
        const need = options.target - existing.length;
        if (need > 0) jobs.push({ topic, subtopicId: subtopic.id, subtopicLabel: subtopic.label, level, existing: existing.map((item) => item.question), need });
      }
    }
  }
  if (options.subtopicId && !topics.some((topic) => topic.subtopics.some((subtopic) => subtopic.id === options.subtopicId))) {
    throw new Error(`Unknown subtopic "${options.subtopicId}"`);
  }
  return jobs;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pre-fills the pool once, so ordinary sessions mostly reuse reviewed questions. Safe to stop and re-run. */
export async function seedPool(generator: QuestionGeneratorService, storage: StorageService, options: SeedOptions): Promise<{ jobs: number; added: number }> {
  const jobs = await planSeed(storage, options);
  options.log(`${jobs.length} subtopic/level combinations are below ${options.target} pooled questions.`);
  if (options.dryRun) {
    for (const job of jobs.slice(0, 60)) options.log(`  would add ${Math.min(job.need, options.batch)}+ for ${job.topic.id}/${job.subtopicId} @ ${job.level} (has ${job.existing.length})`);
    const calls = jobs.reduce((sum, job) => sum + Math.ceil(job.need / options.batch) * 2, 0);
    options.log(`Estimated Gemini calls: about ${calls} (writer plus reviewer per batch). Nothing was written.`);
    return { jobs: jobs.length, added: 0 };
  }

  let added = 0;
  for (const [index, job] of jobs.entries()) {
    let remaining = job.need;
    const seen = [...job.existing];
    while (remaining > 0) {
      const count = Math.min(remaining, options.batch);
      const before = (await storage.poolCandidates(job.subtopicId, job.level, QUESTION_PROMPT_VERSION, 200)).length;
      try {
        await generator.generate({ topic: job.topic, level: job.level, total: count, subtopicIds: [job.subtopicId], avoid: seen, usePool: false });
      } catch (error) {
        options.log(`  [${index + 1}/${jobs.length}] ${job.subtopicId}@${job.level} failed: ${(error as Error).message}. Skipping; re-run to retry.`);
        break;
      }
      const after = await storage.poolCandidates(job.subtopicId, job.level, QUESTION_PROMPT_VERSION, 200);
      const gained = after.length - before;
      added += gained;
      remaining -= count;
      seen.push(...after.map((item) => item.question));
      options.log(`  [${index + 1}/${jobs.length}] ${job.topic.id}/${job.subtopicId} @ ${job.level}: +${gained} (pool ${after.length})`);
      await sleep(options.delayMs);
      if (gained === 0) break; // nothing new passed review; do not loop on the same prompt
    }
  }
  options.log(`Done. Added ${added} questions.`);
  return { jobs: jobs.length, added };
}
