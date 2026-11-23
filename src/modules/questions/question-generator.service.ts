import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Level } from '../../domain/levels';
import { StoredQuestionPlanItem } from '../../domain/session.types';
import { TopicDef, subtopicLabel } from '../curriculum/curriculum.data';
import { AiUnavailableError, GeminiService } from '../llm/gemini.service';
import { buildGenerationPrompt, buildJudgePrompt, judgeSchema, questionSchema } from './question-prompts';
import { CleanQuestion, RawQuestion, validateCandidate } from './question-validator';
import { QuestionPoolService } from './question-pool.service';
import { Slot, SlotGroup, planMixedSlots, planSlots } from './slot-planner';

export interface GenerateQuestionsInput {
  topic: TopicDef;
  level: Level;
  total: number;
  subtopicIds?: string[];
  focus?: string[];
  /** Questions this user has already seen on this topic. */
  avoid?: string[];
  /** False skips reading the shared pool, used when deliberately filling it. Newly written questions are still pooled. */
  usePool?: boolean;
}

export interface MixedQuestionsInput {
  level: Level;
  groups: Array<{ topic: TopicDef; count: number; subtopicIds?: string[]; focus?: string[] }>;
  avoid?: string[];
}

interface JudgeVerdict {
  slot: number;
  onTopic: boolean;
  levelFit: 'too_easy' | 'ok' | 'too_hard';
  clear: boolean;
  reason?: string;
}

const MAX_ROUNDS = 3;
const MAX_AVOID = 25;

@Injectable()
export class QuestionGeneratorService {
  private readonly logger = new Logger(QuestionGeneratorService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
    private readonly pool: QuestionPoolService,
  ) {}

  /**
   * Plans slots in code, has Gemini write one question per slot, rejects bad ones with
   * deterministic checks plus a batched reviewer call, and regenerates only the rejected slots.
   * A question the reviewer rejected is never shown. If a slot still has no acceptable question after
   * the retry rounds, fewer questions are returned (or none, which the session service turns into a 503).
   */
  async generate(input: GenerateQuestionsInput): Promise<StoredQuestionPlanItem[]> {
    const slots = planSlots({
      topic: input.topic,
      level: input.level,
      total: input.total,
      subtopicIds: input.subtopicIds,
      focus: input.focus,
    });
    return this.run(slots, [input.topic], input.level, input.avoid, input.usePool !== false);
  }

  /** Several topics in one session (resume interviews). Questions alternate between topics. */
  async generateMixed(input: MixedQuestionsInput): Promise<StoredQuestionPlanItem[]> {
    const groups: SlotGroup[] = input.groups.map((group) => ({
      topic: group.topic,
      count: group.count,
      subtopicIds: group.subtopicIds,
      focus: group.focus,
    }));
    const slots = planMixedSlots(groups, input.level);
    return this.run(
      slots,
      input.groups.map((group) => group.topic),
      input.level,
      input.avoid,
      true,
    );
  }

  private async run(
    slots: Slot[],
    topics: TopicDef[],
    level: Level,
    avoidInput: string[] = [],
    usePool = true,
  ): Promise<StoredQuestionPlanItem[]> {
    const avoid = avoidInput.slice(0, MAX_AVOID);
    const topicById = new Map(topics.map((topic) => [topic.id, topic]));
    const label = topics.map((topic) => topic.id).join('+');

    const accepted = new Map<number, CleanQuestion>();

    // Reuse reviewed questions first. Only what the pool cannot cover is sent to Gemini.
    const fromPool = usePool
      ? await this.pool.fill({ slots, topicById, level, avoid: avoidInput, accepted })
      : { servedIds: [] as string[], fetched: new Map() };
    let pending = slots.filter((slot) => !accepted.has(slot.index));
    if (fromPool.servedIds.length > 0) {
      this.logger.log(`question pool: ${fromPool.servedIds.length}/${slots.length} slots reused for ${label}/${level}, ${pending.length} to generate`);
    }

    // Only questions the reviewer explicitly approved are good enough to share with other users.
    const approved = new Set<number>();

    for (let round = 1; round <= MAX_ROUNDS && pending.length > 0; round += 1) {
      let candidates: CleanQuestion[];
      try {
        candidates = await this.writeQuestions(topics, topicById, level, pending, avoid, accepted);
      } catch (error) {
        if (round === 1 || error instanceof AiUnavailableError === false) throw error;
        this.logger.warn(`Regeneration round ${round} failed; keeping what was accepted so far.`);
        break;
      }

      const verdicts = await this.review(topicById, level, candidates, slots);
      for (const candidate of candidates) {
        const verdict = verdicts.get(candidate.slot);
        if (!verdict || this.passes(verdict)) {
          accepted.set(candidate.slot, candidate);
          if (verdict) approved.add(candidate.slot);
        } else {
          this.logger.warn(
            `Reviewer rejected slot ${candidate.slot} (${label}/${level}): onTopic=${verdict.onTopic} levelFit=${verdict.levelFit} clear=${verdict.clear} ${verdict.reason ?? ''}`,
          );
        }
      }
      pending = slots.filter((slot) => !accepted.has(slot.index));
    }

    const slotById = new Map(slots.map((slot) => [slot.index, slot]));
    await Promise.all([
      this.pool.remember(
        [...approved].map((index) => ({ slot: slotById.get(index) as Slot, question: accepted.get(index) as CleanQuestion })),
        level,
        fromPool.fetched,
      ),
      this.pool.markUsed(fromPool.servedIds),
    ]);

    const ordered = slots.filter((slot) => accepted.has(slot.index)).map((slot) => ({ slot, question: accepted.get(slot.index) as CleanQuestion }));
    if (ordered.length < slots.length) {
      this.logger.warn(`Generated ${ordered.length}/${slots.length} questions for ${label}/${level}.`);
    }
    return ordered.map(({ slot, question }) => this.toPlanItem(topicById.get(slot.topicId) as TopicDef, question));
  }

  private passes(verdict: JudgeVerdict): boolean {
    return verdict.onTopic && verdict.clear && verdict.levelFit === 'ok';
  }

  private async writeQuestions(
    topics: TopicDef[],
    topicById: Map<string, TopicDef>,
    level: Level,
    slots: Slot[],
    avoid: string[],
    accepted: Map<number, CleanQuestion>,
  ): Promise<CleanQuestion[]> {
    const { system, prompt } = buildGenerationPrompt({ topics, level, slots, avoid });
    const response = await this.gemini.generateJson<{ questions?: RawQuestion[] }>({
      model: this.config.get<string>('gemini.model', 'gemini-3.8-flash'),
      fallbackModels: this.config.get<string[]>('gemini.fallbackModels', []),
      system,
      prompt,
      schema: questionSchema(topics),
      temperature: 0.8,
      thinking: this.config.get<string>('gemini.generationThinking', 'low'),
      maxOutputTokens: 16000,
    });

    const knownTexts = [...avoid, ...[...accepted.values()].map((question) => question.question)];
    const bySlot = new Map(slots.map((slot) => [slot.index, slot]));
    const clean: CleanQuestion[] = [];

    for (const raw of response.questions ?? []) {
      const slot = bySlot.get(Number(raw.slot));
      if (!slot || clean.some((item) => item.slot === slot.index)) continue;
      // A question must belong to its own slot's topic, even in a mixed session.
      const allowedSubtopicIds = new Set((topicById.get(slot.topicId)?.subtopics ?? []).map((subtopic) => subtopic.id));
      const result = validateCandidate(raw, slot, { level, allowedSubtopicIds, knownTexts });
      if (result.ok) {
        clean.push(result.question);
        knownTexts.push(result.question.question);
      } else {
        this.logger.warn(`Rejected slot ${slot.index} (${slot.topicId}/${level}): ${result.reasons.join(', ')}`);
      }
    }
    return clean;
  }

  /** Returns verdicts by slot. Reviewer failures never block a session: no verdict means accept. */
  private async review(
    topicById: Map<string, TopicDef>,
    level: Level,
    candidates: CleanQuestion[],
    slots: Slot[],
  ): Promise<Map<number, JudgeVerdict>> {
    const verdicts = new Map<number, JudgeVerdict>();
    if (candidates.length === 0 || !this.config.get<boolean>('gemini.judgeEnabled', true)) return verdicts;

    const slotById = new Map(slots.map((slot) => [slot.index, slot]));
    const { system, prompt } = buildJudgePrompt({
      level,
      items: candidates.map((candidate) => {
        const topic = topicById.get(slotById.get(candidate.slot)?.topicId ?? '') as TopicDef;
        return {
          slot: candidate.slot,
          topic: topic.label,
          subtopic: subtopicLabel(topic, candidate.subtopicId),
          question: candidate.question,
        };
      }),
    });
    try {
      const response = await this.gemini.generateJson<{ verdicts?: JudgeVerdict[] }>({
        model: this.config.get<string>('gemini.judgeModel', 'gemini-3.1-flash-lite'),
        system,
        prompt,
        schema: judgeSchema,
        temperature: 0,
        maxOutputTokens: 4000,
      });
      for (const verdict of response.verdicts ?? []) verdicts.set(Number(verdict.slot), verdict);
    } catch (error) {
      this.logger.warn(`Question reviewer unavailable, accepting generated questions: ${(error as Error).message}`);
    }
    return verdicts;
  }

  private toPlanItem(topic: TopicDef, question: CleanQuestion): StoredQuestionPlanItem {
    return {
      questionId: `${topic.id}.${question.subtopicId}::${randomBytes(4).toString('hex')}`,
      topicId: topic.id,
      subtopicId: question.subtopicId,
      subtopic: subtopicLabel(topic, question.subtopicId),
      concept: question.concept,
      type: question.type,
      level: question.level,
      renderedQuestion: question.question,
      expectedPoints: question.expectedPoints,
      commonMistakes: question.commonMistakes,
    };
  }
}
