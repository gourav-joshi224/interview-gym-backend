import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Level } from '../../domain/levels';
import { TopicDef } from '../curriculum/curriculum.data';
import { StorageService } from '../storage/storage.service';
import { PooledQuestion, poolId } from './question-pool.types';
import { QUESTION_PROMPT_VERSION } from './question-prompts';
import { CleanQuestion, similarity, validateCandidate } from './question-validator';
import { Slot } from './slot-planner';

const SIMILAR = 0.6;

export interface PoolFillResult {
  /** Ids of pooled questions that were handed to this session. */
  servedIds: string[];
  /** Pool contents per "subtopic" key, only for keys that were read successfully. */
  fetched: Map<string, PooledQuestion[]>;
}

export interface PoolFillInput {
  slots: Slot[];
  topicById: Map<string, TopicDef>;
  level: Level;
  /** Questions this user has already seen. A pooled question that resembles one of them is skipped. */
  avoid: string[];
  /** Filled in place: slot index to the question chosen for it. */
  accepted: Map<number, CleanQuestion>;
}

/**
 * A shared pool of reviewed questions. Reusing one costs a database read instead of a Gemini call, so the
 * more people practise a subtopic and level, the fewer questions need generating.
 *
 * It must never make a session worse or fail: every read and write is best effort, pooled questions are
 * re-validated with today's rules before use, and anything built from user-typed text stays out.
 */
@Injectable()
export class QuestionPoolService {
  private readonly logger = new Logger(QuestionPoolService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** Overridable so tests can control which slots are sent for fresh generation. */
  protected random(): number {
    return Math.random();
  }

  private get settings() {
    return {
      enabled: this.config.get<boolean>('pool.enabled', true),
      minToReuse: this.config.get<number>('pool.minToReuse', 3),
      freshRate: this.config.get<number>('pool.freshRate', 0.1),
      maxPerKey: this.config.get<number>('pool.maxPerKey', 60),
    };
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  /** Fills as many slots as the pool can cover. Slots it cannot cover are left for the writer. */
  async fill(input: PoolFillInput): Promise<PoolFillResult> {
    const result: PoolFillResult = { servedIds: [], fetched: new Map() };
    const { enabled, minToReuse, freshRate, maxPerKey } = this.settings;
    if (!enabled) return result;

    const eligible = input.slots.filter((slot) => !slot.focus && slot.subtopicId);
    const keys = [...new Set(eligible.map((slot) => slot.subtopicId as string))];

    await Promise.all(
      keys.map(async (subtopicId) => {
        try {
          const items = await this.storage.poolCandidates(subtopicId, input.level, QUESTION_PROMPT_VERSION, maxPerKey);
          result.fetched.set(subtopicId, items);
        } catch (error) {
          this.logger.warn(`Question pool read failed for ${subtopicId}; generating instead. ${(error as Error).message}`);
        }
      }),
    );

    const usedInSession = new Set<string>();
    for (const slot of eligible) {
      const subtopicId = slot.subtopicId as string;
      const pool = result.fetched.get(subtopicId);
      if (!pool) continue;
      // A share of sessions always gets fresh questions, so the pool keeps growing and does not go stale.
      if (this.random() < freshRate) continue;

      const unseen = pool.filter((item) => !usedInSession.has(item.id) && !input.avoid.some((seen) => similarity(seen, item.question) >= SIMILAR));
      if (unseen.length < minToReuse) continue;

      const topic = input.topicById.get(slot.topicId);
      const allowedSubtopicIds = new Set((topic?.subtopics ?? []).map((subtopic) => subtopic.id));
      for (const item of this.rank(unseen, slot)) {
        const knownTexts = [...input.avoid, ...[...input.accepted.values()].map((question) => question.question)];
        // Re-check with today's rules: the pool may predate a tighter validator.
        const checked = validateCandidate(
          { slot: slot.index, subtopicId: item.subtopicId, type: item.type, level: item.level, concept: item.concept, question: item.question, expectedPoints: item.expectedPoints, commonMistakes: item.commonMistakes },
          slot,
          { level: input.level, allowedSubtopicIds, knownTexts },
        );
        if (!checked.ok) continue;
        input.accepted.set(slot.index, checked.question);
        usedInSession.add(item.id);
        result.servedIds.push(item.id);
        break;
      }
    }
    return result;
  }

  /** Prefers a matching question type, then the least-used question, so the pool is worn evenly. */
  private rank(items: PooledQuestion[], slot: Slot): PooledQuestion[] {
    return items
      .map((item) => ({ item, tie: this.random() }))
      .sort((left, right) => {
        const typeDelta = Number(right.item.type === slot.type) - Number(left.item.type === slot.type);
        return typeDelta || left.item.uses - right.item.uses || left.tie - right.tie;
      })
      .map(({ item }) => item);
  }

  /** Stores freshly generated, reviewer-approved questions. Never throws. */
  async remember(
    entries: Array<{ slot: Slot; question: CleanQuestion }>,
    level: Level,
    fetched: Map<string, PooledQuestion[]>,
  ): Promise<number> {
    const { enabled, maxPerKey } = this.settings;
    if (!enabled || entries.length === 0) return 0;

    const fresh: PooledQuestion[] = [];
    const room = new Map<string, number>();
    for (const { slot, question } of entries) {
      // Questions aimed at a user's own weak concept contain text they typed, so they are never shared.
      if (slot.focus) continue;
      const existing = fetched.get(question.subtopicId) ?? [];
      const sameKey = [...existing, ...fresh.filter((item) => item.subtopicId === question.subtopicId)];
      const free = room.get(question.subtopicId) ?? maxPerKey - existing.length;
      if (free <= 0) continue;
      if (sameKey.some((item) => similarity(item.question, question.question) >= SIMILAR)) continue;
      room.set(question.subtopicId, free - 1);
      fresh.push({
        id: poolId(question.subtopicId, level, question.question),
        topicId: slot.topicId,
        subtopicId: question.subtopicId,
        level,
        type: question.type,
        concept: question.concept,
        question: question.question,
        expectedPoints: question.expectedPoints,
        commonMistakes: question.commonMistakes,
        promptVersion: QUESTION_PROMPT_VERSION,
        uses: 0,
      });
    }
    if (fresh.length === 0) return 0;
    try {
      return await this.storage.poolSave(fresh);
    } catch (error) {
      this.logger.warn(`Could not add ${fresh.length} questions to the pool: ${(error as Error).message}`);
      return 0;
    }
  }

  async markUsed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.storage.poolMarkUsed(ids);
    } catch (error) {
      this.logger.warn(`Could not record pool usage: ${(error as Error).message}`);
    }
  }
}
