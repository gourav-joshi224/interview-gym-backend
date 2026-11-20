import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Level } from '../../domain/levels';
import { StoredQuestionPlanItem } from '../../domain/session.types';
import { TopicDef, subtopicLabel } from '../curriculum/curriculum.data';
import { AiUnavailableError, GeminiService } from '../llm/gemini.service';
import { buildGenerationPrompt, buildJudgePrompt, judgeSchema, questionSchema } from './question-prompts';
import { CleanQuestion, RawQuestion, validateCandidate } from './question-validator';
import { Slot, planSlots } from './slot-planner';

export interface GenerateQuestionsInput {
  topic: TopicDef;
  level: Level;
  total: number;
  subtopicIds?: string[];
  focus?: string[];
  /** Questions this user has already seen on this topic. */
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
  ) {}

  /**
   * Plans slots in code, has Gemini write one question per slot, rejects bad ones with
   * deterministic checks plus a batched reviewer call, and regenerates only the rejected slots.
   * A question the reviewer rejected is never shown. If a slot still has no acceptable question after
   * the retry rounds, fewer questions are returned (or none, which the session service turns into a 503).
   */
  async generate(input: GenerateQuestionsInput): Promise<StoredQuestionPlanItem[]> {
    const { topic, level } = input;
    const slots = planSlots({
      topic,
      level,
      total: input.total,
      subtopicIds: input.subtopicIds,
      focus: input.focus,
    });
    const avoid = (input.avoid ?? []).slice(0, MAX_AVOID);
    const allowedSubtopicIds = new Set(topic.subtopics.map((subtopic) => subtopic.id));

    const accepted = new Map<number, CleanQuestion>();
    let pending = slots;

    for (let round = 1; round <= MAX_ROUNDS && pending.length > 0; round += 1) {
      let candidates: CleanQuestion[];
      try {
        candidates = await this.writeQuestions(input, pending, avoid, accepted, allowedSubtopicIds);
      } catch (error) {
        if (round === 1 || error instanceof AiUnavailableError === false) throw error;
        this.logger.warn(`Regeneration round ${round} failed; keeping what was accepted so far.`);
        break;
      }

      const verdicts = await this.review(input, candidates);
      for (const candidate of candidates) {
        const verdict = verdicts.get(candidate.slot);
        if (!verdict || this.passes(verdict)) {
          accepted.set(candidate.slot, candidate);
        } else {
          this.logger.warn(
            `Reviewer rejected slot ${candidate.slot} (${topic.id}/${level}): onTopic=${verdict.onTopic} levelFit=${verdict.levelFit} clear=${verdict.clear} ${verdict.reason ?? ''}`,
          );
        }
      }
      pending = slots.filter((slot) => !accepted.has(slot.index));
    }

    const ordered = slots.filter((slot) => accepted.has(slot.index)).map((slot) => accepted.get(slot.index) as CleanQuestion);
    if (ordered.length < input.total) {
      this.logger.warn(`Generated ${ordered.length}/${input.total} questions for ${topic.id}/${level}.`);
    }
    return ordered.map((question) => this.toPlanItem(topic, question));
  }

  private passes(verdict: JudgeVerdict): boolean {
    return verdict.onTopic && verdict.clear && verdict.levelFit === 'ok';
  }

  private async writeQuestions(
    input: GenerateQuestionsInput,
    slots: Slot[],
    avoid: string[],
    accepted: Map<number, CleanQuestion>,
    allowedSubtopicIds: Set<string>,
  ): Promise<CleanQuestion[]> {
    const { topic, level } = input;
    const { system, prompt } = buildGenerationPrompt({ topic, level, slots, avoid });
    const response = await this.gemini.generateJson<{ questions?: RawQuestion[] }>({
      model: this.config.get<string>('gemini.model', 'gemini-3.8-flash'),
      fallbackModels: this.config.get<string[]>('gemini.fallbackModels', []),
      system,
      prompt,
      schema: questionSchema(topic),
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
      const result = validateCandidate(raw, slot, { level, allowedSubtopicIds, knownTexts });
      if (result.ok) {
        clean.push(result.question);
        knownTexts.push(result.question.question);
      } else {
        this.logger.warn(`Rejected slot ${slot.index} (${topic.id}/${level}): ${result.reasons.join(', ')}`);
      }
    }
    return clean;
  }

  /** Returns verdicts by slot. Reviewer failures never block a session: no verdict means accept. */
  private async review(input: GenerateQuestionsInput, candidates: CleanQuestion[]): Promise<Map<number, JudgeVerdict>> {
    const verdicts = new Map<number, JudgeVerdict>();
    if (candidates.length === 0 || !this.config.get<boolean>('gemini.judgeEnabled', true)) return verdicts;

    const { system, prompt } = buildJudgePrompt({
      topic: input.topic,
      level: input.level,
      items: candidates.map((candidate) => ({
        slot: candidate.slot,
        subtopic: subtopicLabel(input.topic, candidate.subtopicId),
        question: candidate.question,
      })),
    });
    try {
      const response = await this.gemini.generateJson<{ verdicts?: JudgeVerdict[] }>({
        model: this.config.get<string>('gemini.judgeModel', 'gemini-3.5-flash-lite'),
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
