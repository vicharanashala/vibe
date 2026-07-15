import {injectable} from 'inversify';
import {MongoClient, Collection, ObjectId} from 'mongodb';
import {screeningConfig} from '#root/config/screening.js';

/** One embedded question stem, keyed to the lesson segment it belongs to. */
export interface IQuestionVector {
  questionId: ObjectId;
  segmentId: ObjectId;
  text: string;
  embedding: number[];
  /** Model that produced `embedding` — a model change invalidates every vector. */
  model: string;
  dims: number;
  at: Date;
}

/** A retrieved neighbour, scored in PLAIN COSINE space (see `toCosine`). */
export interface VectorHit {
  questionId: string;
  text: string;
  /** Cosine similarity in [-1, 1] — directly comparable to the calibration output. */
  cosine: number;
}

/**
 * Atlas Vector Search store for question stems.
 *
 * Lives on its OWN cluster (`VECTOR_DB_URL`), separate from the application DB.
 * That keeps a brand-new index + collection well away from production data, and
 * `$vectorSearch` never needs to join anything — each vector doc already carries
 * the question id and text it stands for.
 *
 * SCORE UNITS — the subtle part. Atlas does not return raw cosine: for `cosine`
 * and `dotProduct` similarity it normalises to `(1 + similarity) / 2`, i.e. a
 * cosine of 0.93 surfaces as a score of 0.965. Every threshold in this codebase
 * was calibrated in raw-cosine space, so we convert back here and expose cosine
 * only — otherwise a 0.93 threshold would really be firing at cosine 0.86.
 */
@injectable()
export class QuestionVectorRepository {
  private client: MongoClient | null = null;
  private collection: Collection<IQuestionVector> | null = null;

  /** Atlas score → raw cosine. Inverse of Atlas's `(1 + cosine) / 2`. */
  private static toCosine(atlasScore: number): number {
    return 2 * atlasScore - 1;
  }

  /** True when a vector cluster is configured. Callers fall back to the LLM path otherwise. */
  isConfigured(): boolean {
    return !!screeningConfig.vector.dbUrl;
  }

  private async coll(): Promise<Collection<IQuestionVector>> {
    if (this.collection) return this.collection;
    const {dbUrl, dbName, collection} = screeningConfig.vector;
    if (!dbUrl) throw new Error('VECTOR_DB_URL not set');
    this.client = new MongoClient(dbUrl);
    await this.client.connect();
    this.collection = this.client.db(dbName).collection<IQuestionVector>(collection);
    return this.collection;
  }

  /**
   * Store (or refresh) the vector for a question. Idempotent on `questionId`, so
   * a re-run of the backfill — or a question whose text was edited — is safe.
   */
  async upsert(v: Omit<IQuestionVector, 'at'>): Promise<void> {
    const c = await this.coll();
    await c.updateOne(
      {questionId: v.questionId},
      {$set: {...v, at: new Date()}},
      {upsert: true},
    );
  }

  async upsertMany(vs: Omit<IQuestionVector, 'at'>[]): Promise<void> {
    if (vs.length === 0) return;
    const c = await this.coll();
    await c.bulkWrite(
      vs.map(v => ({
        updateOne: {
          filter: {questionId: v.questionId},
          update: {$set: {...v, at: new Date()}},
          upsert: true,
        },
      })),
    );
  }

  /** Drop a question's vector (e.g. it was deleted from the bank). */
  async remove(questionId: ObjectId): Promise<void> {
    const c = await this.coll();
    await c.deleteOne({questionId});
  }

  /**
   * Nearest neighbours to `queryVector` WITHIN one lesson segment, best first.
   *
   * The segment filter is what makes this cheap and correct: a question is only
   * ever a duplicate of another question on the same segment, and pre-filtering
   * keeps the ANN search from ranging over the whole bank.
   */
  async search(
    segmentId: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorHit[]> {
    const c = await this.coll();
    const rows = await c
      .aggregate([
        {
          $vectorSearch: {
            index: screeningConfig.vector.indexName,
            path: 'embedding',
            queryVector,
            // Atlas recommends oversampling the ANN candidate pool ~20x the limit
            // so the top-K is actually the true top-K and not an ANN artefact.
            numCandidates: Math.max(topK * 20, 100),
            limit: topK,
            filter: {segmentId: new ObjectId(segmentId)},
          },
        },
        {
          $project: {
            _id: 0,
            questionId: 1,
            text: 1,
            score: {$meta: 'vectorSearchScore'},
          },
        },
      ])
      .toArray();

    return rows.map(r => ({
      questionId: String((r as any).questionId),
      text: String((r as any).text ?? ''),
      cosine: QuestionVectorRepository.toCosine(Number((r as any).score)),
    }));
  }

  /** How many vectors exist for a segment — lets callers skip a pointless search. */
  async countForSegment(segmentId: string): Promise<number> {
    const c = await this.coll();
    return c.countDocuments({segmentId: new ObjectId(segmentId)});
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.collection = null;
  }
}
