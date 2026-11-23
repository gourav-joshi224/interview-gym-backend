# Interview Gym backend

NestJS API for the Interview Gym app. It writes interview questions with Gemini, runs the session, grades answers, and stores results in Firestore.

## How a session works

1. `GET /curriculum` lists topics, subtopics and levels (public).
2. `POST /session/start` takes `{ topic, level, subtopics?, focus?, totalQuestions }`.
   - The server plans one **slot** per question (subtopic and question type) in code, so coverage and mix never depend on the model.
   - Gemini writes one question per slot, with 3 to 5 checkable *expected points*.
   - Each question passes code checks (level rules, subtopic, length, duplicates against what the user already saw). A cheaper reviewer model then checks topic, level fit and clarity in one batched call. Rejected slots are regenerated once.
   - The plan is stored with the session. Fewer questions than requested are returned rather than padded with bad ones; the response carries the real `totalQuestions`.
3. `POST /session/progress` with `{ sessionId, questionId, answer }` saves one answer and returns the next question, or `done: true`.
4. `POST /session/finish` with `{ sessionId }` grades all answers in one Gemini call. Per-point verdicts (`covered`, `partial`, `missed`) come from the model; **scores are computed in code** from those verdicts. Empty, "I don't know" and noise answers score 0 without a model call. A finished session returns its stored report instead of being graded again.
5. `GET /session/:id` returns where the user is, so the client can resume after a refresh.
6. `GET /dashboard/my-sessions` lists the signed-in user's sessions.

All routes except `/curriculum` and `/health` require a Firebase ID token (`Authorization: Bearer ...`). The user id always comes from the verified token. Other users' sessions return 404.

## Keeping Gemini usage low

Questions that pass code checks **and** the reviewer are stored in a shared Firestore collection, `questionPool`, keyed by subtopic, level and `QUESTION_PROMPT_VERSION`. When a session starts, each slot is filled from the pool when at least `QUESTION_POOL_MIN_TO_REUSE` questions the user has not seen exist for that subtopic and level. Only the remaining slots are sent to Gemini, so a fully covered session makes no generation call at all (grading still makes one).

Rules that keep this safe:
- A pooled question is re-validated with the current rules before it is served.
- A user never receives a question that matches one from their recent sessions.
- "Retry weak areas" questions are never read from or written to the pool, because they contain text the user typed.
- `QUESTION_POOL_FRESH_RATE` of questions are generated fresh even when the pool could serve them, so the pool keeps growing.
- Pool reads and writes are best effort. A pool outage means normal generation, never a failed session.
- Bump `QUESTION_PROMPT_VERSION` in `question-prompts.ts` after a prompt or anchor change that makes old questions worse. Old entries are then ignored.

Pre-fill the pool once so most sessions reuse reviewed questions from day one. Always start with a dry run, since a full fill is hundreds of Gemini calls:

```bash
npm run build
npm run seed:pool -- --dry-run --target 6
npm run seed:pool -- --topic javascript --level beginner --target 6
npm run seed:pool -- --topic javascript --subtopic scope-closures --level beginner --target 4
```

The tool skips combinations that already have enough questions, so it is safe to stop and re-run.

Levels are `beginner`, `intermediate`, `advanced`. Their wording lives in `src/domain/levels.ts` and is what the prompts and the reviewer use. Topics and subtopics live in `src/modules/curriculum/curriculum.data.ts`.

## Run

```bash
cp .env.example .env   # fill in GEMINI_API_KEY and the Firebase service account
npm install
npm run start:dev      # http://localhost:3001, Swagger at /api-docs (not in production)
npm test
npm run build && npm start
```

## Firestore

Collection `interviewSessions` needs a composite index on `userId` (ascending) and `createdAt` (descending). Access goes through the Admin SDK, so Firestore security rules can deny all client access.

## Not covered by tests

Calls to the live Gemini API and live Firestore are faked in tests. Run one real session after configuring keys before relying on it.
