import { Logger } from '@nestjs/common';

const THINKING_LEVELS = ['', 'minimal', 'low', 'medium', 'high'];

const isProduction = () => (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

const positiveInt = (field: string, raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`ENV_VALIDATION_FAILED: ${field} must be a number > 0`);
  }
  return parsed;
};

/** Fails fast on boot when required configuration is missing or malformed. */
export const validateEnv = (): void => {
  const logger = new Logger('EnvValidation');
  const fail = (field: string, reason: string): never => {
    throw new Error(`ENV_VALIDATION_FAILED: ${field} ${reason}`);
  };

  positiveInt('PORT', process.env.PORT, 3001);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (isProduction()) {
    if (!corsOrigin) fail('CORS_ORIGIN', 'is required in production');
    if (corsOrigin === '*') fail('CORS_ORIGIN', 'must be an explicit origin list in production');
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    if (isProduction()) fail('GEMINI_API_KEY', 'is required in production');
    logger.warn('GEMINI_API_KEY missing: starting and finishing sessions will return AI_NOT_CONFIGURED.');
  }

  for (const field of ['GEMINI_GENERATION_THINKING', 'GEMINI_GRADING_THINKING']) {
    const value = (process.env[field] ?? '').trim().toLowerCase();
    if (!THINKING_LEVELS.includes(value)) {
      fail(field, `must be one of: ${THINKING_LEVELS.filter(Boolean).join(', ')} (or empty to disable)`);
    }
  }

  if (!process.env.FIREBASE_PROJECT_ID?.trim()) fail('FIREBASE_PROJECT_ID', 'is required');
  if (!process.env.FIREBASE_CLIENT_EMAIL?.includes('@')) fail('FIREBASE_CLIENT_EMAIL', 'must be a service account email');
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').trim();
  if (!privateKey.includes('BEGIN')) fail('FIREBASE_PRIVATE_KEY', 'must be the full PEM private key');

  positiveInt('MAX_SESSIONS_PER_DAY', process.env.MAX_SESSIONS_PER_DAY, 30);
};

export default () => ({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    judgeModel: process.env.GEMINI_JUDGE_MODEL?.trim() || 'gemini-3.5-flash-lite',
    judgeEnabled: (process.env.QUESTION_JUDGE_ENABLED ?? 'true').toLowerCase() !== 'false',
    generationThinking: (process.env.GEMINI_GENERATION_THINKING ?? 'low').trim().toLowerCase(),
    gradingThinking: (process.env.GEMINI_GRADING_THINKING ?? 'medium').trim().toLowerCase(),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 60000),
  },
  limits: {
    maxSessionsPerDay: Number(process.env.MAX_SESSIONS_PER_DAY ?? 30),
  },
});
