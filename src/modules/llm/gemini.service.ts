import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface GenerateJsonInput {
  model: string;
  /** Tried in order when `model` is overloaded, rate limited or unavailable. */
  fallbackModels?: string[];
  system: string;
  prompt: string;
  /** JSON Schema object; Gemini constrains its output to it. */
  schema: Record<string, unknown>;
  temperature?: number;
  /** minimal | low | medium | high. Empty or undefined leaves the model default. */
  thinking?: string;
  maxOutputTokens?: number;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
/** A model that just failed with overload or quota is skipped for this long, so later calls do not wait on it. */
const COOLDOWN_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AiErrorCode = 'AI_NOT_CONFIGURED' | 'AI_UNAVAILABLE' | 'AI_BAD_RESPONSE';

export class AiUnavailableError extends HttpException {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super({ error: code, message }, 503);
  }
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = this.config.get<string>('gemini.apiKey', '');
    if (!apiKey) {
      throw new AiUnavailableError('AI_NOT_CONFIGURED', 'The AI provider is not configured on the server.');
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private readonly coolingUntil = new Map<string, number>();

  /**
   * Calls Gemini with a JSON schema and returns the parsed object.
   * Tries the primary model first, then each fallback. A model that fails with overload or quota is put
   * on a short cooldown so the next request goes straight to a healthy one.
   * Callers must still validate the returned shape; the schema is a strong hint, not a proof.
   */
  async generateJson<T>(input: GenerateJsonInput): Promise<T> {
    const client = this.getClient();
    const timeoutMs = this.config.get<number>('gemini.timeoutMs', 30000);
    const all = [input.model, ...(input.fallbackModels ?? [])].filter((model, i, list) => model && list.indexOf(model) === i);
    const now = Date.now();
    const healthy = all.filter((model) => (this.coolingUntil.get(model) ?? 0) <= now);
    const chain = healthy.length > 0 ? healthy : all;
    let lastError: unknown;

    for (const model of chain) {
      // A busy model rarely recovers within seconds, so move on quickly. Only the last resort gets retries.
      const attemptsPerModel = model === chain[chain.length - 1] ? 3 : 1;
      for (let attempt = 1; attempt <= attemptsPerModel; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await client.models.generateContent({
            model,
            contents: input.prompt,
            config: {
              systemInstruction: input.system,
              responseMimeType: 'application/json',
              responseJsonSchema: input.schema,
              temperature: input.temperature ?? 0.7,
              maxOutputTokens: input.maxOutputTokens,
              abortSignal: controller.signal,
              ...this.thinkingConfig(input.thinking),
            },
          });
          const text = response.text?.trim();
          if (!text) throw new AiUnavailableError('AI_BAD_RESPONSE', 'The AI provider returned an empty response.');
          try {
            return JSON.parse(text) as T;
          } catch {
            throw new AiUnavailableError('AI_BAD_RESPONSE', 'The AI provider returned malformed JSON.');
          }
        } catch (error) {
          lastError = error;
          const retryable = this.isRetryable(error);
          this.logger.warn(
            `Gemini call failed (model=${model}, attempt ${attempt}/${attemptsPerModel}): ${this.describe(error)}${retryable ? '' : ' (not retryable)'}`,
          );
          if (!retryable || attempt === attemptsPerModel) {
            if (this.isOverload(error)) this.coolingUntil.set(model, Date.now() + COOLDOWN_MS);
            break;
          }
          await sleep(this.config.get<number>('gemini.backoffMs', 800) * 2 ** (attempt - 1));
        } finally {
          clearTimeout(timer);
        }
      }
      if (chain.length > 1 && model !== chain[chain.length - 1]) {
        this.logger.warn(`Switching from ${model} to the next fallback model.`);
      }
    }

    this.logger.error(`Gemini failed on every model (${chain.join(', ')}): ${this.describe(lastError)}`);
    if (lastError instanceof AiUnavailableError) throw lastError;
    throw new AiUnavailableError('AI_UNAVAILABLE', 'The AI provider is temporarily unavailable. Please try again.');
  }

  /** Overload, quota and timeouts say the model is unhealthy right now, not that our request is wrong. */
  private isOverload(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    if (typeof status === 'number') return status === 429 || status >= 500;
    return !(error instanceof AiUnavailableError);
  }

  private thinkingConfig(level?: string) {
    const normalized = (level ?? '').trim().toUpperCase();
    if (!normalized) return {};
    const mapped = ThinkingLevel[normalized as keyof typeof ThinkingLevel];
    return mapped ? { thinkingConfig: { thinkingLevel: mapped } } : {};
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof AiUnavailableError) return error.code === 'AI_BAD_RESPONSE';
    const status = (error as { status?: number })?.status;
    if (typeof status === 'number') return RETRYABLE_STATUS.has(status);
    // Aborts and network errors surface without a status.
    return true;
  }

  private describe(error: unknown): string {
    if (!error) return 'unknown';
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    return `${status ? `status=${status} ` : ''}${message.slice(0, 300)}`;
  }
}
