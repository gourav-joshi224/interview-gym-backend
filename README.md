# Interview Brain Backend

NestJS backend for an AI-powered interview practice app. It generates topic-aware interview questions, evaluates answers, manages multi-question interview sessions, stores results in Firebase/Firestore, and exposes a dashboard-friendly history API.

## What This Backend Does

- Generates interview questions for supported backend-focused topics.
- Uses an internal question assembly pipeline before falling back to the configured LLM provider.
- Evaluates single answers and returns structured feedback.
- Runs full interview sessions with question plans, progress tracking, and final reports.
- Stores interview results and session data in Firestore.
- Exposes recent interview history for a dashboard UI.
- Ships with Swagger docs, validation, logging, API-key protection, and basic in-memory rate limiting.

## Main Capabilities

### 1. Question Generation

`POST /interview/question`

The backend first tries to build questions from its internal topic packs and rendering pipeline. If a topic cannot be assembled there, it can fall back to the configured OpenAI-compatible provider.

Supported built-in topics:

- `javascript`
- `node.js` / `nodejs`
- `system design`
- `caching`
- `databases`
- `queues`
- `apis`
- `concurrency`

### 2. Answer Evaluation

`POST /interview/evaluate`

Evaluates a candidate answer and returns:

- numeric score
- strengths
- missing concepts
- user-friendly explanation
- ideal answer
- follow-up question
- skill breakdown
- learning resources

Single-answer evaluations are also persisted to Firestore.

### 3. Interview Sessions

Session APIs let the frontend run a guided interview flow:

- `POST /session/start` creates a question plan and returns the first question
- `POST /session/progress` saves answers and returns the next question
- `POST /session/finish` evaluates the full session and returns a final report

The session pipeline stores question metadata so evaluation stays aligned with the exact generated question and rubric.

### 4. Dashboard History

`GET /dashboard/interviews?limit=20`

Returns recent interview records for dashboard views. The limit is clamped to `1-50`.

## Architecture Overview

### Core Modules

- `src/modules/interview`
  Handles single-question generation and answer evaluation.
- `src/modules/session`
  Manages start/progress/finish interview session flows.
- `src/modules/interview-brain`
  Contains the internal question packs, planning rules, rendering, validation, evaluation, and aggregation logic.
- `src/modules/ai`
  Wraps the OpenAI-compatible client used for fallback generation and evaluation.
- `src/modules/storage`
  Persists interview records and interview sessions to Firestore via the REST API.
- `src/modules/dashboard`
  Returns recent interview history for the frontend.
- `src/modules/cache`
  Placeholder cache layer for question generation hooks.

### Request Safeguards

- Global request validation with NestJS `ValidationPipe`
- Global exception filter and logging interceptor
- In-memory IP rate limiting: `60` requests per minute
- Optional `x-api-key` protection through `INTERNAL_API_KEY`
  If `INTERNAL_API_KEY` is not set, requests are allowed in dev mode.

## API Docs

Swagger UI is available at:

```text
http://localhost:3001/api-docs
```

The app accepts both normal and `/api`-prefixed controller routes for frontend compatibility.

Examples:

- `POST /interview/question` and `POST /api/interview/question`
- `POST /session/start` and `POST /api/session/start`

## Local Development

### Prerequisites

- Node.js
- npm
- Firebase project credentials for Firestore storage
- An OpenAI-compatible API key if you want live model responses

### Install and Run

```bash
cp .env.example .env
npm install
npm run start:dev
```

By default the app runs on:

```text
http://0.0.0.0:3001
```

Common local frontend origin:

```text
http://localhost:3000 or http://localhost:6969
```

## Environment Variables

The project validates environment configuration on boot.

### Required for normal app startup

```env
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000,http://localhost:6969
XAI_MODEL=your_AI_model
FIREBASE_API_KEY=your_firebase_web_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Optional but recommended

```env
XAI_API_KEY=your_provider_api_key
XAI_BASE_URL=https://api.groq.com/openai/v1
INTERNAL_API_KEY=your_internal_frontend_api_key
DEBUG_QUESTION_PIPELINE=false
INTERVIEW_DEBUG=false
MAX_PER_ARCHETYPE=3
QUESTION_WORD_LIMIT=45
```

Notes:

- `XAI_API_KEY` is optional, but without it live LLM generation/evaluation falls back to local-safe responses.
- `CORS_ORIGIN` is required in production and supports a comma-separated allowlist.
- `FIREBASE_PRIVATE_KEY` must include the full PEM value.
- `.env.example` is currently minimal; the full runtime set is defined in [`src/config/env.config.ts`](/home/unthinkable-lap/Videos/backend/src/config/env.config.ts).

## Endpoints

### Interview

- `POST /interview/question`
- `POST /interview/evaluate`

### Session

- `POST /session/start`
- `POST /session/progress`
- `POST /session/finish`

### Dashboard

- `GET /dashboard/interviews?limit=20`

Equivalent `/api/...` routes are also available.

## Typical Flow

### Single Question Flow

1. Frontend requests a question with topic, experience, and difficulty.
2. Backend assembles a question from topic packs when possible.
3. User submits an answer.
4. Backend evaluates it and stores the interview result.

### Session Flow

1. Frontend calls `/session/start`.
2. Backend creates a session and a full question plan.
3. Frontend sends cumulative answers to `/session/progress`.
4. Backend returns the next question in sequence.
5. Frontend calls `/session/finish`.
6. Backend computes question-level results and a final interview report.

## Testing

Run tests with:

```bash
npm test
```

Current tests cover areas such as:

- session finish scoring behavior
- non-attempt and weak-attempt handling
- question assembly diversity and uniqueness
- JavaScript question rendering and metadata-driven evaluation

## Project Structure

```text
src/
  common/                 guards, filters, interceptors
  config/                 environment validation and config loading
  modules/
    ai/                   provider client + fallback behavior
    cache/                cache hooks
    dashboard/            recent interview history endpoints
    interview/            single question/evaluation endpoints
    interview-brain/      topic packs, planning, rendering, scoring
    session/              multi-step interview session flow
    storage/              Firestore persistence
test/                     integration-style and pipeline tests
```

## Notes

- Firestore storage is used through the REST API rather than the Firebase Admin SDK.
- Session evaluation is largely driven by the internal `interview-brain` logic, not only by raw LLM output.
- If the model provider fails, the backend is designed to return schema-safe fallback responses instead of crashing.
