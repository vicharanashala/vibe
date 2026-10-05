import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { injectable } from 'inversify';
import { Storage } from '@google-cloud/storage';
import { InternalServerError } from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { storageConfig } from '#root/config/storage.js';
import { IExam, IExamQuestion, IExamQuestionOption } from '../classes/transformers/Exam.js';
import { IAttemptProctoringEvent, IExamAttempt } from '../classes/transformers/Attempt.js';
import { IQuestionBankEntry } from '../classes/transformers/QuestionBank.js';

/** Matches a base64-encoded image data URL, e.g. `data:image/png;base64,AAAA...`. */
const DATA_URL_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/;

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

/**
 * Handles moving exam-related images (question/option images, proctoring
 * snapshots) out of MongoDB documents and into Google Cloud Storage, mirroring
 * `modules/anomalies/services/CloudStorageService.ts` (same `Storage` /
 * `bucket.file().save()` / `getSignedUrl()` shape, same config convention via
 * `storageConfig.googleCloud`).
 *
 * Design choice — store the raw GCS object path in Mongo, sign on every read:
 * A long-lived signed URL stored directly in the document would eventually go
 * stale while just sitting in the database (exam results are reviewed
 * indefinitely). Storing the bucket-relative object path instead and calling
 * `getSignedUrl` fresh on every read (see `resolveExamImages`/
 * `resolveAttemptImages` below) means a URL can never go stale in storage —
 * only the read-time expiry (see `getSignedUrl`) matters, and that is
 * regenerated on every request. This does mean every read path that returns
 * exam/attempt data has to call through this service (see `ExamService`/
 * `AttemptService`), but that turned out to be a small, mechanical set of
 * call sites rather than "too much complexity", so the fallback (a long-lived
 * URL stored directly) was not needed.
 */
@injectable()
export class ExamImageStorageService {
  private googleStorage: Storage;
  private bucketName: string;

  constructor() {
    this.googleStorage = new Storage({
      projectId: storageConfig.googleCloud.projectId,
    });
    this.bucketName = storageConfig.googleCloud.examMediaBucketName;
  }

  /** True for a base64 image data URL; false for `undefined`, a stored object path, or a real URL. */
  isBase64DataUrl(value: string | undefined): value is string {
    return typeof value === 'string' && DATA_URL_RE.test(value);
  }

  /**
   * Decodes a base64 image data URL and uploads it to the exam-media bucket
   * under `${pathPrefix}/${randomUUID()}.${ext}`. Returns the bucket-relative
   * object path (NOT a URL) — see the class doc for why. Throws
   * `InternalServerError` on failure, same as `CloudStorageService` — callers
   * decide whether that should propagate (question-authoring, see
   * `resolveUploadForQuestionImage`) or be swallowed (proctoring snapshots,
   * see `resolveUploadForProctoringImage`).
   */
  async uploadDataUrl(dataUrl: string, pathPrefix: string): Promise<string> {
    const match = dataUrl.match(DATA_URL_RE);
    if (!match) {
      throw new InternalServerError('Not a valid base64 image data URL');
    }
    const [, rawExt, base64Payload] = match;
    // "svg+xml" -> "svg" for the filename; the full rawExt is kept for contentType.
    const ext = rawExt.split('+')[0] || 'bin';
    const buffer = Buffer.from(base64Payload, 'base64');
    const objectPath = `${pathPrefix}/${randomUUID()}.${ext}`;

    const bucket = this.googleStorage.bucket(this.bucketName);
    const file = bucket.file(objectPath);

    try {
      await file.save(buffer, {
        metadata: { contentType: `image/${rawExt}` },
      });
    } catch (error) {
      throw new InternalServerError(`Failed to upload exam image: ${error.message}`);
    }

    return objectPath;
  }

  /** Mirrors `CloudStorageService.getSignedUrl` exactly: read access, throws on failure. */
  async getSignedUrl(objectPath: string): Promise<string> {
    const bucket = this.googleStorage.bucket(this.bucketName);
    const file = bucket.file(objectPath);

    try {
      const [url] = await file.getSignedUrl({
        action: 'read',
        // Regenerated fresh on every read (see class doc), so this only has
        // to outlive a single request/page-load, not the document's life.
        expires: Date.now() + 60 * 60 * 1000,
      });
      return url;
    } catch (error) {
      throw new InternalServerError(`Failed to get signed URL: ${error.message}`);
    }
  }

  /**
   * If `value` is a signed URL this service previously issued for an object
   * in our own bucket, returns the underlying object path; otherwise
   * `undefined`.
   *
   * Why this exists: `EditExamPage.jsx`'s question-edit form seeds its local
   * state from the exam it fetched (i.e. an already-resolved signed URL) and
   * always resends `questionImage`/`options[].image` on save, whether or not
   * the teacher actually changed the image. Without this, an unchanged image
   * would get its *signed URL* (query string, expiry and all) written back
   * into Mongo on every edit instead of the durable object path — which
   * would then read back fine until the signature expired, then break
   * silently. Recognizing our own signed URL on the way back in and
   * unwrapping it to the durable path keeps every write idempotent.
   */
  private extractOwnObjectPath(value: string): string | undefined {
    if (!isHttpUrl(value)) return undefined;
    try {
      const url = new URL(value);
      if (url.hostname === 'storage.googleapis.com') {
        // Path-style: https://storage.googleapis.com/<bucket>/<object...>
        const prefix = `/${this.bucketName}/`;
        if (url.pathname.startsWith(prefix)) {
          return decodeURIComponent(url.pathname.slice(prefix.length));
        }
        return undefined;
      }
      if (url.hostname === `${this.bucketName}.storage.googleapis.com`) {
        // Virtual-hosted-style: https://<bucket>.storage.googleapis.com/<object...>
        return decodeURIComponent(url.pathname.replace(/^\//, ''));
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Upload-if-base64 for teacher-authored content (question/option images).
   * This is a deliberate content-authoring action, so an upload failure
   * fails loudly (propagates `InternalServerError`) rather than silently
   * dropping the image — the teacher needs to know the save didn't fully
   * succeed.
   */
  async resolveUploadForQuestionImage(
    value: string | undefined,
    pathPrefix: string,
  ): Promise<string | undefined> {
    if (value === undefined) return undefined;
    if (this.isBase64DataUrl(value)) {
      return this.uploadDataUrl(value, pathPrefix);
    }
    // Round-trips our own previously-issued signed URL back to the durable
    // object path (see extractOwnObjectPath doc) instead of persisting it
    // as-is. Anything else (an already-stored object path, a foreign URL, a
    // pre-migration raw base64 string we chose not to touch) passes through.
    return this.extractOwnObjectPath(value) ?? value;
  }

  /**
   * Upload-if-base64 for student-captured proctoring snapshots. Unlike
   * question images, this runs inline during `AttemptService.submitAttempt`
   * — a broken image upload must never block a student from submitting
   * their exam. So failures are logged and the single offending snapshot is
   * dropped (its `imageDataUrl` becomes `undefined`) rather than failing the
   * whole submission.
   */
  async resolveUploadForProctoringImage(
    value: string | undefined,
    pathPrefix: string,
  ): Promise<string | undefined> {
    if (value === undefined) return undefined;
    if (!this.isBase64DataUrl(value)) return value;

    try {
      return await this.uploadDataUrl(value, pathPrefix);
    } catch (error) {
      console.warn(
        '[ExamImageStorageService] dropping proctoring snapshot after upload failure:',
        error,
      );
      return undefined;
    }
  }

  /**
   * Turns a stored field value into something a client can render directly:
   * - `undefined` -> `undefined`.
   * - A stored GCS object path -> a freshly-signed read URL.
   * - A base64 data URL (a document saved before this migration) -> returned
   *   as-is; it is already directly renderable, and this module does not
   *   attempt to migrate/backfill old documents.
   * - Anything already a URL (defensive) -> returned as-is.
   *
   * Never throws: a single broken/missing object must not fail an entire
   * exam/attempt read. Logs and resolves to `undefined` instead.
   */
  private async toReadableUrl(value: string | undefined): Promise<string | undefined> {
    if (!value) return value;
    if (this.isBase64DataUrl(value) || isHttpUrl(value)) return value;

    try {
      return await this.getSignedUrl(value);
    } catch (error) {
      console.warn(`[ExamImageStorageService] failed to resolve image "${value}":`, error);
      return undefined;
    }
  }

  /**
   * Generic over `T extends IExamQuestion` (not just `IExamQuestion` itself)
   * so the same image-resolution logic can run on a plain exam question OR
   * on a question-bank entry (`IQuestionBankEntry` extends `IExamQuestion`
   * with extra `_id`/`createdBy`/timestamp fields) without duplicating this
   * method — see `resolveQuestionBankEntry(ies)` below, used instead of a
   * copy-pasted bank-specific version.
   */
  private async resolveQuestionArray<T extends IExamQuestion>(questions: T[] | undefined): Promise<T[]> {
    return Promise.all(
      (questions ?? []).map(async question => ({
        ...question,
        questionImage: await this.toReadableUrl(question.questionImage),
        options: await Promise.all(
          (question.options ?? []).map(async (option: IExamQuestionOption) => ({
            ...option,
            image: await this.toReadableUrl(option.image),
          })),
        ),
      } as T)),
    );
  }

  /**
   * `@JsonController({ transformResponse: true })` runs every controller
   * return value through class-transformer's `instanceToPlain`, which does
   * not honor `ObjectId`'s own `toJSON()` — it walks the instance as a plain
   * class and serializes its internal buffer instead, turning `_id` into
   * `{ buffer: { ... } }` on the wire instead of a hex string. Every
   * `IExam`/`IExamAttempt`/`IQuestionBankEntry` response funnels through one
   * of this class's `resolve*` methods, so normalizing `_id` here (rather
   * than at every repository call site) fixes it everywhere in one place.
   */
  private normalizeId<T extends { _id?: ObjectId | string }>(doc: T): T {
    if (doc._id instanceof ObjectId) {
      return { ...doc, _id: doc._id.toString() };
    }
    return doc;
  }

  /** Resolves every `questionImage`/`options[].image` on a single exam to a readable URL. */
  async resolveExamImages(exam: IExam): Promise<IExam> {
    if (!exam) return exam;
    return this.normalizeId({ ...exam, questions: await this.resolveQuestionArray(exam.questions) });
  }

  /** Batch form of `resolveExamImages`, for list endpoints (findByCreator/findPublished). */
  async resolveExamsImages(exams: IExam[]): Promise<IExam[]> {
    return Promise.all(exams.map(exam => this.resolveExamImages(exam)));
  }

  /** Resolves `questionImage`/`options[].image` on a single question-bank entry. */
  async resolveQuestionBankEntry(entry: IQuestionBankEntry): Promise<IQuestionBankEntry> {
    if (!entry) return entry;
    const [resolved] = await this.resolveQuestionArray([entry]);
    return this.normalizeId(resolved);
  }

  /** Batch form of `resolveQuestionBankEntry`, for `QuestionBankService.listMine`. */
  async resolveQuestionBankEntries(entries: IQuestionBankEntry[]): Promise<IQuestionBankEntry[]> {
    const resolved = await this.resolveQuestionArray(entries);
    return resolved.map(entry => this.normalizeId(entry));
  }

  private async resolveProctoringEvents(
    events: IAttemptProctoringEvent[] | undefined,
  ): Promise<IAttemptProctoringEvent[] | undefined> {
    if (!events) return events;
    return Promise.all(
      events.map(async event => ({
        ...event,
        imageDataUrl: await this.toReadableUrl(event.imageDataUrl),
      })),
    );
  }

  /**
   * Resolves every `questionImage`/`options[].image` on the attempt's
   * question snapshot, plus every `proctoringEvents[].imageDataUrl`, to
   * readable URLs.
   */
  async resolveAttemptImages(attempt: IExamAttempt): Promise<IExamAttempt> {
    if (!attempt) return attempt;
    const [questions, proctoringEvents] = await Promise.all([
      this.resolveQuestionArray(attempt.questions),
      this.resolveProctoringEvents(attempt.proctoringEvents),
    ]);
    return this.normalizeId({ ...attempt, questions, proctoringEvents });
  }

  /** Batch form of `resolveAttemptImages`, for list endpoints (listByStudent/listByExam). */
  async resolveAttemptsImages(attempts: IExamAttempt[]): Promise<IExamAttempt[]> {
    return Promise.all(attempts.map(attempt => this.resolveAttemptImages(attempt)));
  }
}
