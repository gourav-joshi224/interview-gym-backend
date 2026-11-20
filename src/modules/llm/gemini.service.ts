import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface GenerateJsonInput {
  model: string;
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
const MAX_ATTEMPTS = 3;

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

  /**
   * Calls Gemini with a JSON schema and returns the parsed object.
   * Retries transient failures (rate limit, 5xx, timeouts) with backoff.
   * Callers must still validate the returned shape; the schema is a strong hint, not a proof.
   */
  async generateJson<T>(input: GenerateJsonInput): Promise<T> {
    const client = this.getClient();
    const timeoutMs = this.config.get<number>('gemini.timeoutMs', 60000);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await client.models.generateContent({
          model: input.model,
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
        if (!text) {
          throw new AiUnavailableError('AI_BAD_RESPONSE', 'The AI provider returned an empty response.');
        }
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new AiUnavailableError('AI_BAD_RESPONSE', 'The AI provider returned malformed JSON.');
        }
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        const delay = 800 * 2 ** (attempt - 1);
        this.logger.warn(
          `Gemini call failed (attempt ${attempt}/${MAX_ATTEMPTS}, model=${input.model}): ${this.describe(error)}. Retrying in ${delay}ms.`,
        );
        await sleep(delay);
      } finally {
        clearTimeout(timer);
      }
    }

    this.logger.error(`Gemini call failed permanently (model=${input.model}): ${this.describe(lastError)}`);
    if (lastError instanceof AiUnavailableError) throw lastError;
    throw new AiUnavailableError('AI_UNAVAILABLE', 'The AI provider is temporarily unavailable. Please try again.');
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
