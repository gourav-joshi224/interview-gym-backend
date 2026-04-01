import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { getFirebaseAdmin } from '../../common/firebase-admin';

type SkillBreakdown = {
  architecture: number;
  scalability: number;
  dataModeling: number;
  caching: number;
};

type EvaluationResource = {
  title: string;
  url: string;
};

type EvaluationResult = {
  score: number;
  strengths: string[];
  missingConcepts: string[];
  explanationForUser: string;
  idealAnswer: string;
  followUpQuestion: string;
  skillBreakdown: SkillBreakdown;
  learningResources: EvaluationResource[];
};

type SessionStatus = 'in_progress' | 'completed';

type InterviewSessionAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export type StoredQuestionPlanItem = {
  questionId: string;
  topicId: string;
  familyKey: string;
  archetype: string;
  hookId: string;
  concepts: string[];
  subtopic: string;
  rubricId?: string;
  constraintSnapshot: Array<{ id: string; label: string; text: string }>;
  renderedQuestion: string;
};

type DynamicSkillScore = {
  skill: string;
  score: number;
};

type InterviewFinalReport = {
  overallScore: number;
  strengths: string[];
  weakAreas: string[];
  communicationFeedback: string;
  technicalFeedback: string;
  improvementPlan: string;
  skillBreakdown: DynamicSkillScore[];
  learningResources: EvaluationResource[];
};

type SaveInterviewInput = {
  topic: string;
  experience: string;
  difficulty: string;
  mode?: string;
  selectedSkill?: string;
  question: string;
  answer: string;
} & EvaluationResult & {
    cached?: boolean;
  };

type SaveInterviewSessionInput = {
  topic: string;
  experience: string;
  difficulty: string;
  totalQuestions: number;
  questionDeficit?: number;
  answers: InterviewSessionAnswer[];
  status: SessionStatus;
  report?: InterviewFinalReport | null;
  questionPlan?: StoredQuestionPlanItem[];
  userId?: string | null;
  sessionVersion?: number;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values: FirestoreValue[] } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreFields = Record<string, FirestoreValue>;
type FirestoreQueryResultItem = { document?: FirestoreDocument };
type FirestoreListDocumentsResponse = {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
};

const SESSION_FIELD_ALLOWLIST = new Set([
  'topic',
  'experience',
  'difficulty',
  'totalQuestions',
  'questionDeficit',
  'answers',
  'status',
  'report',
  'questionPlan',
  'createdAt',
  'updatedAt',
  'finishedAt',
  'userId',
  'sessionVersion',
]);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly firebaseConfig: { apiKey: string; projectId: string };

  constructor(private readonly configService: ConfigService) {
    this.firebaseConfig = this.loadFirebaseConfig();
  }

  async saveInterview(input: SaveInterviewInput): Promise<string | null> {
    const config = this.getFirebaseConfig();

    const response = await this.firestoreFetch(this.collectionUrl('interviews', config.apiKey, config.projectId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: this.buildStoredFields(input) }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to save interview: ${details}`);
    }

    const payload = (await response.json()) as { name?: string };
    return payload.name?.split('/').pop() ?? null;
  }

  async getRecentInterviews(limit = 20): Promise<Array<Record<string, unknown>>> {
    const config = this.getFirebaseConfig();

    const response = await this.firestoreFetch(this.runQueryUrl(config.apiKey, config.projectId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'interviews' }],
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to fetch interview history: ${details}`);
    }

    const payload = (await response.json()) as Array<{ document?: FirestoreDocument }>;

    return payload
      .map((item) => (item.document ? this.parseInterviewDocument(item.document) : null))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  async createInterviewSession(input: SaveInterviewSessionInput): Promise<string> {
    const config = this.getFirebaseConfig();
    const sessionId = randomUUID();
    const fields = this.buildSessionFieldsForCreate(input);
    const updateMask = Object.keys(fields);
    const documentPath = `interviewSessions/${sessionId}`;
    const updateTransforms = [
      this.serverTimestampTransform('createdAt'),
      this.serverTimestampTransform('updatedAt'),
    ];

    this.logger.log(
      `Firestore createInterviewSession projectId="${config.projectId}" documentPath="${documentPath}" userId="${input.userId ?? 'null'}" status="${input.status}" answers=${input.answers.length}`,
    );

    if (input.status === 'completed') {
      updateTransforms.push(this.serverTimestampTransform('finishedAt'));
    }

    const response = await this.firestoreFetch(this.commitUrl(config.apiKey, config.projectId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: this.documentName(documentPath, config.projectId),
              fields,
            },
            updateMask: { fieldPaths: updateMask },
            currentDocument: { exists: false },
            updateTransforms,
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      this.logger.error(
        `Firestore createInterviewSession failed projectId="${config.projectId}" documentPath="${documentPath}" details="${details}"`,
      );
      throw new Error(`Failed to create interview session: ${details}`);
    }

    this.logger.log(
      `Firestore createInterviewSession succeeded projectId="${config.projectId}" documentPath="${documentPath}"`,
    );

    return sessionId;
  }

  async updateInterviewSession(
    sessionId: string,
    input: Partial<SaveInterviewSessionInput>,
    options?: { markFinished?: boolean },
  ): Promise<void> {
    const config = this.getFirebaseConfig();
    const fields = this.buildSessionFields(input);
    const updateMask = Object.keys(fields);
    const documentPath = `interviewSessions/${sessionId}`;

    if (updateMask.length === 0) {
      throw new Error('No fields provided to update interview session.');
    }
    const updateTransforms = [this.serverTimestampTransform('updatedAt')];

    if (options?.markFinished) {
      updateTransforms.push(this.serverTimestampTransform('finishedAt'));
    }

    this.logger.log(
      `Firestore updateInterviewSession projectId="${config.projectId}" documentPath="${documentPath}" updateMask="${updateMask.join(',')}" markFinished=${options?.markFinished === true}`,
    );

    const response = await this.firestoreFetch(this.commitUrl(config.apiKey, config.projectId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: this.documentName(documentPath, config.projectId),
              fields,
            },
            updateMask: { fieldPaths: updateMask },
            updateTransforms,
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      this.logger.error(
        `Firestore updateInterviewSession failed projectId="${config.projectId}" documentPath="${documentPath}" details="${details}"`,
      );
      throw new Error(`Failed to update interview session: ${details}`);
    }

    this.logger.log(
      `Firestore updateInterviewSession succeeded projectId="${config.projectId}" documentPath="${documentPath}"`,
    );
  }

  async getInterviewSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const config = this.getFirebaseConfig();
    const documentPath = `interviewSessions/${sessionId}`;

    this.logger.log(
      `Firestore getInterviewSession projectId="${config.projectId}" documentPath="${documentPath}"`,
    );

    const response = await this.firestoreFetch(
      this.documentUrl(documentPath, config.apiKey, config.projectId),
      {
        method: 'GET',
      },
    );

    if (response.status === 404) {
      this.logger.warn(
        `Firestore getInterviewSession not found projectId="${config.projectId}" documentPath="${documentPath}"`,
      );
      return null;
    }

    if (!response.ok) {
      const details = await response.text();
      this.logger.error(
        `Firestore getInterviewSession failed projectId="${config.projectId}" documentPath="${documentPath}" details="${details}"`,
      );
      throw new Error(`Failed to fetch interview session: ${details}`);
    }

    this.logger.log(
      `Firestore getInterviewSession succeeded projectId="${config.projectId}" documentPath="${documentPath}"`,
    );

    const document = (await response.json()) as FirestoreDocument;
    return this.parseSessionDocument(document);
  }

  async upsertUser(uid: string, name: string, email: string): Promise<void> {
    const config = this.getFirebaseConfig();
    const fields: Record<string, FirestoreValue> = {
      uid: this.stringField(uid),
      name: this.stringField(name),
      email: this.stringField(email),
      updatedAt: this.timestampField(new Date().toISOString()),
    };
    const query = new URLSearchParams({ key: config.apiKey });

    for (const fieldPath of Object.keys(fields)) {
      query.append('updateMask.fieldPaths', fieldPath);
    }

    const response = await this.firestoreFetch(
      `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${uid}?${query.toString()}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.documentName(`users/${uid}`, config.projectId),
          fields,
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to upsert user: ${details}`);
    }
  }

  async getUser(uid: string): Promise<{ uid: string; name: string; email: string } | null> {
    const config = this.getFirebaseConfig();

    const response = await this.firestoreFetch(this.documentUrl(`users/${uid}`, config.apiKey, config.projectId), {
      method: 'GET',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to fetch user: ${details}`);
    }

    const document = (await response.json()) as FirestoreDocument;
    return this.parseUserDocument(document);
  }

  async getSessionsByUserId(uid: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const payload = await this.querySessionDocumentsByUserId(uid, limit);

    return payload
      .map((item) => (item.document ? this.parseSessionDocument(item.document) : null))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((session) => ({
        sessionId: session.sessionId,
        topic: session.topic,
        experience: session.experience,
        difficulty: session.difficulty,
        totalQuestions: session.totalQuestions,
        status: session.status,
        overallScore:
          session.report && typeof session.report === 'object'
            ? (session.report as { overallScore?: unknown }).overallScore ?? null
            : null,
        createdAt: session.createdAt,
      }));
  }

  async getDetailedSessionsByUserId(uid: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const payload = await this.querySessionDocumentsByUserId(uid, limit);

    return payload
      .map((item) => (item.document ? this.parseSessionDocument(item.document) : null))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  async cleanupInterviewSessionFieldsByUserId(
    uid: string,
    limit: number,
  ): Promise<{
    scanned: number;
    cleaned: number;
    unchanged: number;
    sessions: Array<{ sessionId: string; removedFields: string[] }>;
  }> {
    const config = this.getFirebaseConfig();
    const payload = await this.querySessionDocumentsByUserId(uid, limit);
    const sessions: Array<{ sessionId: string; removedFields: string[] }> = [];

    for (const item of payload) {
      const document = item.document;
      if (!document?.name || !document.fields) {
        continue;
      }

      const removedFields = Object.keys(document.fields).filter((field) => !SESSION_FIELD_ALLOWLIST.has(field));
      if (!removedFields.length) {
        continue;
      }

      this.logger.log(
        `Firestore cleanupInterviewSessionFields projectId="${config.projectId}" documentPath="${document.name.split('/documents/')[1] ?? document.name}" removedFields="${removedFields.join(',')}"`,
      );

      const response = await this.firestoreFetch(this.commitUrl(config.apiKey, config.projectId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: document.name,
              },
              updateMask: { fieldPaths: removedFields },
              updateTransforms: [this.serverTimestampTransform('updatedAt')],
            },
          ],
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Failed to clean interview session fields: ${details}`);
      }

      sessions.push({
        sessionId: document.name.split('/').pop() ?? '',
        removedFields,
      });
    }

    const scanned = payload.filter((item) => Boolean(item.document?.name)).length;
    const cleaned = sessions.length;
    const unchanged = scanned - cleaned;

    return {
      scanned,
      cleaned,
      unchanged,
      sessions,
    };
  }

  async deleteAllInterviewSessions(): Promise<{
    scanned: number;
    deleted: number;
    failed: number;
    sessionIds: string[];
  }> {
    const config = this.getFirebaseConfig();
    const documents = await this.listAllInterviewSessionDocuments();
    const sessionIds = documents
      .map((document) => document.name?.split('/').pop() ?? '')
      .filter(Boolean);

    if (!documents.length) {
      return {
        scanned: 0,
        deleted: 0,
        failed: 0,
        sessionIds: [],
      };
    }

    const chunkSize = 100;
    for (let index = 0; index < documents.length; index += chunkSize) {
      const chunk = documents.slice(index, index + chunkSize);
      const writes = chunk
        .map((document) => document.name)
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ delete: name }));

      this.logger.warn(
        `Firestore deleteAllInterviewSessions projectId="${config.projectId}" batchStart=${index} batchSize=${writes.length}`,
      );

      const response = await this.firestoreFetch(this.commitUrl(config.apiKey, config.projectId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writes }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Failed to delete interview sessions: ${details}`);
      }
    }

    return {
      scanned: documents.length,
      deleted: documents.length,
      failed: 0,
      sessionIds,
    };
  }

  private loadFirebaseConfig() {
    const apiKey = this.configService.get<string>('firebase.apiKey', '');
    const projectId = this.configService.get<string>('firebase.projectId', '');

    const apiKeyLooksValid = /^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey);
    const projectIdLooksValid = /^[a-z][a-z0-9-]{4,}$/.test(projectId);
    const valuesLookSwapped = !apiKeyLooksValid && /^AIza[0-9A-Za-z_-]{20,}$/.test(projectId);

    if (!apiKey || !projectId || !apiKeyLooksValid || !projectIdLooksValid || valuesLookSwapped) {
      throw new Error(
        'STORAGE_INIT_FAILED: Firebase config missing or invalid. Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID.',
      );
    }

    return { apiKey, projectId };
  }

  private getFirebaseConfig() {
    return this.firebaseConfig;
  }

  private stringField(value: string): FirestoreValue {
    return { stringValue: value };
  }

  private integerField(value: number): FirestoreValue {
    return { integerValue: String(value) };
  }

  private booleanField(value: boolean): FirestoreValue {
    return { booleanValue: value };
  }

  private nullField(): FirestoreValue {
    return { nullValue: null };
  }

  private nullableStringField(value: string | null | undefined): FirestoreValue {
    if (value === null || value === undefined) {
      return this.nullField();
    }
    return this.stringField(value);
  }

  private timestampField(value: string): FirestoreValue {
    return { timestampValue: value };
  }

  private arrayField(values: string[]): FirestoreValue {
    return {
      arrayValue: {
        values: values.map((value) => this.stringField(value)),
      },
    };
  }

  private resourceArrayField(values: EvaluationResource[]): FirestoreValue {
    return {
      arrayValue: {
        values: values.map((value) => ({
          mapValue: {
            fields: {
              title: this.stringField(value.title),
              url: this.stringField(value.url),
            },
          },
        })),
      },
    };
  }

  private answersArrayField(values: InterviewSessionAnswer[]): FirestoreValue {
    return {
      arrayValue: {
        values: values.map((value) => ({
          mapValue: {
            fields: {
              questionId: this.stringField(value.questionId),
              question: this.stringField(value.question),
              answer: this.stringField(value.answer),
            },
          },
        })),
      },
    };
  }

  private questionPlanArrayField(values: StoredQuestionPlanItem[]): FirestoreValue {
    return {
      arrayValue: {
        values: values.map((value) => ({
          mapValue: {
            fields: {
              questionId: this.stringField(value.questionId),
              topicId: this.stringField(value.topicId),
              familyKey: this.stringField(value.familyKey),
              archetype: this.stringField(value.archetype),
              hookId: this.stringField(value.hookId),
              subtopic: this.stringField(value.subtopic),
              rubricId: this.stringField(value.rubricId ?? ''),
              renderedQuestion: this.stringField(value.renderedQuestion),
              concepts: this.arrayField(value.concepts),
              constraintSnapshot: {
                arrayValue: {
                  values: value.constraintSnapshot.map((item) => ({
                    mapValue: {
                      fields: {
                        id: this.stringField(item.id),
                        label: this.stringField(item.label),
                        text: this.stringField(item.text),
                      },
                    },
                  })),
                },
              },
            },
          },
        })),
      },
    };
  }

  private dynamicSkillBreakdownField(values: DynamicSkillScore[]): FirestoreValue {
    return {
      arrayValue: {
        values: values.map((value) => ({
          mapValue: {
            fields: {
              skill: this.stringField(value.skill),
              score: this.integerField(value.score),
            },
          },
        })),
      },
    };
  }

  private skillBreakdownField(value: SkillBreakdown): FirestoreValue {
    return {
      mapValue: {
        fields: {
          architecture: this.integerField(value.architecture),
          scalability: this.integerField(value.scalability),
          dataModeling: this.integerField(value.dataModeling),
          caching: this.integerField(value.caching),
        },
      },
    };
  }

  private documentUrl(path: string, apiKey: string, projectId: string) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}`;
  }

  private documentName(path: string, projectId: string) {
    return `projects/${projectId}/databases/(default)/documents/${path}`;
  }

  private collectionUrl(path: string, apiKey: string, projectId: string) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}`;
  }

  private runQueryUrl(apiKey: string, projectId: string) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
  }

  private commitUrl(apiKey: string, projectId: string) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`;
  }

  private collectionDocumentsUrl(path: string, apiKey: string, projectId: string, pageSize: number, pageToken?: string) {
    const query = new URLSearchParams({
      key: apiKey,
      pageSize: String(pageSize),
    });

    if (pageToken) {
      query.set('pageToken', pageToken);
    }

    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${query.toString()}`;
  }

  private async querySessionDocumentsByUserId(uid: string, limit: number): Promise<FirestoreQueryResultItem[]> {
    try {
      const admin = getFirebaseAdmin();
      const snapshot = await admin
        .firestore()
        .collection('interviewSessions')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((document: { ref: { path: string }; data: () => Record<string, unknown> }) => ({
        document: {
          name: this.documentName(document.ref.path, this.firebaseConfig.projectId),
          fields: this.toFirestoreFields(document.data()),
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Admin Firestore query failed for userId="${uid}". Falling back to REST query. ${message}`);
    }

    const config = this.getFirebaseConfig();

    const response = await this.firestoreFetch(this.runQueryUrl(config.apiKey, config.projectId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'interviewSessions' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: uid },
            },
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to fetch user sessions: ${details}`);
    }

    return (await response.json()) as FirestoreQueryResultItem[];
  }

  private async listAllInterviewSessionDocuments(): Promise<FirestoreDocument[]> {
    const config = this.getFirebaseConfig();
    const documents: FirestoreDocument[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await this.firestoreFetch(
        this.collectionDocumentsUrl('interviewSessions', config.apiKey, config.projectId, 100, nextPageToken),
        { method: 'GET' },
      );

      if (response.status === 404) {
        return documents;
      }

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Failed to list interview sessions: ${details}`);
      }

      const payload = (await response.json()) as FirestoreListDocumentsResponse;
      documents.push(...(payload.documents ?? []));
      nextPageToken = payload.nextPageToken;
    } while (nextPageToken);

    return documents;
  }

  private async firestoreFetch(input: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch (error) {
      const errorWithCause = error as Error & { cause?: unknown };
      const reason = error instanceof Error ? errorWithCause.cause ?? error.message : 'unknown transport error';
      const normalizedReason =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : JSON.stringify(reason);

      throw new Error(
        `STORAGE_REQUEST_FAILED: Unable to reach Firestore for project "${this.firebaseConfig.projectId}". ${normalizedReason}`,
      );
    }
  }

  private serverTimestampTransform(fieldPath: string) {
    return { fieldPath, setToServerValue: 'REQUEST_TIME' as const };
  }

  private toFirestoreFields(value: Record<string, unknown>): FirestoreFields {
    return Object.fromEntries(
      Object.entries(value).map(([key, fieldValue]) => [key, this.toFirestoreValue(fieldValue)]),
    );
  }

  private toFirestoreValue(value: unknown): FirestoreValue {
    if (value === null || value === undefined) {
      return { nullValue: null };
    }

    if (typeof value === 'string') {
      return { stringValue: value };
    }

    if (typeof value === 'number') {
      return { integerValue: String(Math.trunc(value)) };
    }

    if (typeof value === 'boolean') {
      return { booleanValue: value };
    }

    if (value instanceof Date) {
      return { timestampValue: value.toISOString() };
    }

    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map((item) => this.toFirestoreValue(item)),
        },
      };
    }

    if (this.isFirestoreTimestamp(value)) {
      return { timestampValue: value.toDate().toISOString() };
    }

    if (typeof value === 'object') {
      return {
        mapValue: {
          fields: this.toFirestoreFields(value as Record<string, unknown>),
        },
      };
    }

    return { nullValue: null };
  }

  private isFirestoreTimestamp(value: unknown): value is { toDate: () => Date } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
    );
  }

  private readString(value: FirestoreValue | undefined) {
    return value && 'stringValue' in value ? value.stringValue : '';
  }

  private readNullableString(value: FirestoreValue | undefined) {
    if (!value) return null;
    if ('nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    return null;
  }

  private readTimestamp(value: FirestoreValue | undefined) {
    return value && 'timestampValue' in value ? value.timestampValue : '';
  }

  private readMapFields(value: FirestoreValue | undefined): FirestoreFields {
    if (!value || !('mapValue' in value)) {
      return {};
    }

    return value.mapValue.fields ?? {};
  }

  private readNumber(value: FirestoreValue | undefined) {
    if (!value || !('integerValue' in value)) {
      return 0;
    }

    return Number(value.integerValue) || 0;
  }

  private readBoolean(value: FirestoreValue | undefined) {
    return Boolean(value && 'booleanValue' in value ? value.booleanValue : false);
  }

  private readStringArray(value: FirestoreValue | undefined) {
    if (!value || !('arrayValue' in value)) {
      return [];
    }

    return (value.arrayValue.values ?? [])
      .map((item) => ('stringValue' in item ? item.stringValue : ''))
      .filter(Boolean);
  }

  private readAnswers(value: FirestoreValue | undefined): InterviewSessionAnswer[] {
    if (!value || !('arrayValue' in value)) {
      return [];
    }

    return (value.arrayValue.values ?? [])
      .map((item) => {
        if (!('mapValue' in item)) {
          return null;
        }

        const fields = item.mapValue.fields ?? {};

        return {
          questionId: this.readString(fields.questionId),
          question: this.readString(fields.question),
          answer: this.readString(fields.answer),
        };
      })
      .filter((item): item is InterviewSessionAnswer => Boolean(item?.questionId));
  }

  private readQuestionPlan(value: FirestoreValue | undefined): StoredQuestionPlanItem[] {
    if (!value || !('arrayValue' in value)) {
      return [];
    }

    const items = (value.arrayValue.values ?? [])
      .map((item): StoredQuestionPlanItem | null => {
        if (!('mapValue' in item)) return null;
        const fields = item.mapValue.fields ?? {};
        const constraints = this.readConstraintSnapshot(fields.constraintSnapshot);
        return {
          questionId: this.readString(fields.questionId),
          topicId: this.readString(fields.topicId),
          familyKey: this.readString(fields.familyKey),
          archetype: this.readString(fields.archetype),
          hookId: this.readString(fields.hookId),
          subtopic: this.readString(fields.subtopic),
          rubricId: this.readString(fields.rubricId) || undefined,
          renderedQuestion: this.readString(fields.renderedQuestion),
          concepts: this.readStringArray(fields.concepts),
          constraintSnapshot: constraints,
        };
      })
      .filter((item): item is StoredQuestionPlanItem => Boolean(item && item.questionId));

    return items;
  }

  private readConstraintSnapshot(value: FirestoreValue | undefined): Array<{ id: string; label: string; text: string }> {
    if (!value || !('arrayValue' in value)) {
      return [];
    }
    return (value.arrayValue.values ?? [])
      .map((item) => {
        if (!('mapValue' in item)) return null;
        const fields = item.mapValue.fields ?? {};
        return {
          id: this.readString(fields.id),
          label: this.readString(fields.label),
          text: this.readString(fields.text),
        };
      })
      .filter((item): item is { id: string; label: string; text: string } => Boolean(item && item.id));
  }

  private readDynamicSkillBreakdown(value: FirestoreValue | undefined): DynamicSkillScore[] {
    if (!value || !('arrayValue' in value)) {
      return [];
    }

    return (value.arrayValue.values ?? [])
      .map((item) => {
        if (!('mapValue' in item)) {
          return null;
        }

        const fields = item.mapValue.fields ?? {};

        return {
          skill: this.readString(fields.skill),
          score: this.readNumber(fields.score),
        };
      })
      .filter((item): item is DynamicSkillScore => Boolean(item?.skill));
  }

  private readResources(value: FirestoreValue | undefined): EvaluationResource[] {
    if (!value || !('arrayValue' in value)) {
      return [];
    }

    return (value.arrayValue.values ?? [])
      .map((item) => {
        if (!('mapValue' in item)) {
          return null;
        }

        const fields = item.mapValue.fields ?? {};

        return {
          title: this.readString(fields.title),
          url: this.readString(fields.url),
        };
      })
      .filter((item): item is EvaluationResource => Boolean(item?.title && item?.url));
  }

  private readSkillBreakdown(value: FirestoreValue | undefined): SkillBreakdown {
    if (!value || !('mapValue' in value)) {
      return {
        architecture: 0,
        scalability: 0,
        dataModeling: 0,
        caching: 0,
      };
    }

    const fields = value.mapValue.fields ?? {};

    return {
      architecture: this.readNumber(fields.architecture),
      scalability: this.readNumber(fields.scalability),
      dataModeling: this.readNumber(fields.dataModeling),
      caching: this.readNumber(fields.caching),
    };
  }

  private parseInterviewDocument(document: FirestoreDocument): Record<string, unknown> | null {
    const fields = document.fields;
    if (!fields) {
      return null;
    }

    return {
      interviewId: document.name?.split('/').pop(),
      topic: this.readString(fields.topic),
      experience: this.readString(fields.experience),
      difficulty: this.readString(fields.difficulty),
      question: this.readString(fields.question),
      answer: this.readString(fields.answer),
      mode: this.readString(fields.mode) === 'resume' ? 'resume' : 'standard',
      selectedSkill: this.readString(fields.selectedSkill),
      score: this.readNumber(fields.score),
      strengths: this.readStringArray(fields.strengths),
      missingConcepts: this.readStringArray(fields.missingConcepts),
      explanationForUser: this.readString(fields.explanationForUser),
      idealAnswer: this.readString(fields.idealAnswer),
      followUpQuestion: this.readString(fields.followUpQuestion),
      skillBreakdown: this.readSkillBreakdown(fields.skillBreakdown),
      learningResources: this.readResources(fields.learningResources),
      cached: this.readBoolean(fields.cached),
    };
  }

  private parseUserDocument(document: FirestoreDocument): { uid: string; name: string; email: string } | null {
    const fields = document.fields;
    if (!fields) {
      return null;
    }

    return {
      uid: this.readString(fields.uid),
      name: this.readString(fields.name),
      email: this.readString(fields.email),
    };
  }

  private parseSessionDocument(document: FirestoreDocument): Record<string, unknown> | null {
    const fields = document.fields;
    if (!fields) {
      return null;
    }

    const reportValue = fields.report;
    const reportFields = this.readMapFields(reportValue);
    const report =
      Object.keys(reportFields).length > 0
        ? {
            overallScore: this.readNumber(reportFields.overallScore),
            strengths: this.readStringArray(reportFields.strengths),
            weakAreas: this.readStringArray(reportFields.weakAreas),
            communicationFeedback: this.readString(reportFields.communicationFeedback),
            technicalFeedback: this.readString(reportFields.technicalFeedback),
            improvementPlan: this.readString(reportFields.improvementPlan),
            skillBreakdown: this.readDynamicSkillBreakdown(reportFields.skillBreakdown),
            learningResources: this.readResources(reportFields.learningResources),
          }
        : null;

    return {
      sessionId: document.name?.split('/').pop(),
      topic: this.readString(fields.topic),
      experience: this.readString(fields.experience),
      difficulty: this.readString(fields.difficulty),
      totalQuestions: this.readNumber(fields.totalQuestions),
      questionDeficit: this.readNumber(fields.questionDeficit),
      status: this.readString(fields.status) === 'completed' ? 'completed' : 'in_progress',
      answers: this.readAnswers(fields.answers),
      questionPlan: this.readQuestionPlan(fields.questionPlan),
      createdAt: this.readTimestamp(fields.createdAt),
      updatedAt: this.readTimestamp(fields.updatedAt),
      finishedAt: this.readTimestamp(fields.finishedAt),
      userId: this.readNullableString(fields.userId),
      sessionVersion: this.readNumber(fields.sessionVersion) || null,
      report,
    };
  }

  private buildStoredFields(input: SaveInterviewInput) {
    return {
      topic: this.stringField(input.topic),
      experience: this.stringField(input.experience),
      difficulty: this.stringField(input.difficulty),
      question: this.stringField(input.question),
      answer: this.stringField(input.answer),
      mode: this.stringField(input.mode ?? 'standard'),
      selectedSkill: this.stringField(input.selectedSkill ?? ''),
      score: this.integerField(input.score),
      strengths: this.arrayField(input.strengths),
      missingConcepts: this.arrayField(input.missingConcepts),
      explanationForUser: this.stringField(input.explanationForUser),
      idealAnswer: this.stringField(input.idealAnswer),
      followUpQuestion: this.stringField(input.followUpQuestion),
      skillBreakdown: this.skillBreakdownField(input.skillBreakdown),
      learningResources: this.resourceArrayField(input.learningResources),
      cached: this.booleanField(Boolean(input.cached)),
      createdAt: this.timestampField(new Date().toISOString()),
    };
  }

  private buildSessionFieldsForCreate(input: SaveInterviewSessionInput): Record<string, FirestoreValue> {
    return {
      ...this.buildSessionFields({
        topic: input.topic,
        experience: input.experience,
        difficulty: input.difficulty,
        totalQuestions: input.totalQuestions,
        questionDeficit: input.questionDeficit ?? 0,
        answers: input.answers,
        status: input.status,
        questionPlan: input.questionPlan ?? [],
        report: input.report ?? null,
      }),
      userId: this.nullableStringField(input.userId ?? null),
      sessionVersion: this.integerField(1),
    };
  }

  private buildSessionFields(input: Partial<SaveInterviewSessionInput>): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {};

    if (input.topic !== undefined) fields.topic = this.stringField(input.topic);
    if (input.experience !== undefined) fields.experience = this.stringField(input.experience);
    if (input.difficulty !== undefined) fields.difficulty = this.stringField(input.difficulty);
    if (input.totalQuestions !== undefined) fields.totalQuestions = this.integerField(input.totalQuestions);
    if (input.questionDeficit !== undefined) fields.questionDeficit = this.integerField(input.questionDeficit);
    if (input.answers !== undefined) fields.answers = this.answersArrayField(input.answers);
    if (input.status !== undefined) fields.status = this.stringField(input.status);
    if (input.questionPlan !== undefined) fields.questionPlan = this.questionPlanArrayField(input.questionPlan);
    if (input.report !== undefined) fields.report = this.reportField(input.report ?? null);
    if (input.userId !== undefined) fields.userId = this.nullableStringField(input.userId);
    if (input.sessionVersion !== undefined) fields.sessionVersion = this.integerField(input.sessionVersion);

    return fields;
  }

  private reportField(report: InterviewFinalReport | null): FirestoreValue {
    return {
      mapValue: {
        fields: report
          ? {
              overallScore: this.integerField(report.overallScore),
              strengths: this.arrayField(report.strengths),
              weakAreas: this.arrayField(report.weakAreas),
              communicationFeedback: this.stringField(report.communicationFeedback),
              technicalFeedback: this.stringField(report.technicalFeedback),
              improvementPlan: this.stringField(report.improvementPlan),
              skillBreakdown: this.dynamicSkillBreakdownField(report.skillBreakdown),
              learningResources: this.resourceArrayField(report.learningResources),
            }
          : {},
      },
    };
  }
}
