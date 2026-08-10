import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  IVideoAsset,
  VideoAssetStatus,
} from '../../../classes/transformers/VideoAsset.js';

@injectable()
export class VideoAssetRepository {
  private collection!: Collection<IVideoAsset>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.collection = await this.db.getCollection<IVideoAsset>('videoAssets');
    this.initialized = true;

    try {
      // Teacher-facing listing: assets of one course version, newest first.
      await this.collection.createIndex({
        courseVersionId: 1,
        isDeleted: 1,
        createdAt: -1,
      });
      // The readiness poller scans only assets still in flight.
      await this.collection.createIndex({status: 1, lastPolledAt: 1});
      // Library search is by title within a course version.
      await this.collection.createIndex({courseVersionId: 1, title: 1});
    } catch (error) {
      // Index creation is best-effort: a replica lacking permission must not
      // stop the module from serving reads and writes.
      console.warn('[VideoAssetRepository] index creation skipped:', error);
    }
  }

  async create(asset: IVideoAsset): Promise<IVideoAsset> {
    await this.init();
    const result = await this.collection.insertOne(asset);
    return {...asset, _id: result.insertedId};
  }

  async findById(assetId: string): Promise<IVideoAsset | null> {
    await this.init();
    if (!ObjectId.isValid(assetId)) return null;
    return this.collection.findOne({
      _id: new ObjectId(assetId),
      isDeleted: {$ne: true},
    });
  }

  /**
   * The course's video library. Newest first, since a teacher segmenting a
   * lecture they just uploaded is the common case.
   */
  async listByCourseVersion(
    courseVersionId: string,
    options: {limit?: number; search?: string; readyOnly?: boolean} = {},
  ): Promise<IVideoAsset[]> {
    await this.init();
    if (!ObjectId.isValid(courseVersionId)) return [];

    const filter: Record<string, unknown> = {
      courseVersionId: new ObjectId(courseVersionId),
      isDeleted: {$ne: true},
    };

    const search = options.search?.trim();
    if (search) {
      // Escaped so a title containing regex characters is matched literally
      // rather than being interpreted as a pattern.
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{title: pattern}, {originalFileName: pattern}];
    }

    // The picker in the item editor only offers playable videos: a still-
    // processing upload has no playlist to segment against.
    if (options.readyOnly) filter.status = 'READY';

    return this.collection
      .find(filter)
      .sort({createdAt: -1})
      .limit(options.limit ?? 100)
      .toArray();
  }

  async countByCourseVersion(courseVersionId: string): Promise<number> {
    await this.init();
    if (!ObjectId.isValid(courseVersionId)) return 0;
    return this.collection.countDocuments({
      courseVersionId: new ObjectId(courseVersionId),
      isDeleted: {$ne: true},
    });
  }

  /**
   * Assets that may still change state, oldest-polled first. Drives the
   * readiness sweep; a webhook from the pipeline can short-circuit it later
   * without changing this method.
   */
  async listInFlight(limit = 25): Promise<IVideoAsset[]> {
    await this.init();
    return this.collection
      .find({
        status: {$in: ['UPLOADING', 'PROCESSING'] as VideoAssetStatus[]},
        isDeleted: {$ne: true},
      })
      .sort({lastPolledAt: 1})
      .limit(limit)
      .toArray();
  }

  /**
   * Apply a partial change.
   *
   * An explicit `undefined` clears the field. The driver would otherwise write it
   * as null, leaving `description: null` on a type declared `string | undefined`,
   * so those keys are split into `$unset` instead.
   */
  async update(
    assetId: string,
    changes: Partial<IVideoAsset>,
  ): Promise<IVideoAsset | null> {
    await this.init();
    if (!ObjectId.isValid(assetId)) return null;

    const set: Record<string, unknown> = {updatedAt: new Date()};
    const unset: Record<string, ''> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) unset[key] = '';
      else set[key] = value;
    }

    const result = await this.collection.findOneAndUpdate(
      {_id: new ObjectId(assetId), isDeleted: {$ne: true}},
      Object.keys(unset).length > 0 ? {$set: set, $unset: unset} : {$set: set},
      {returnDocument: 'after'},
    );
    return result ?? null;
  }

  /**
   * Whether any course item still plays this asset. Checked before deletion so a
   * lesson cannot be left pointing at a removed video.
   */
  async isReferencedByItem(assetId: string): Promise<boolean> {
    await this.init();
    if (!ObjectId.isValid(assetId)) return false;
    // Video item details live in 'videos' (see ItemRepository.videoCollection),
    // where the asset reference sits on the nested details object.
    const videoItems = await this.db.getCollection('videos');
    const referencing = await videoItems.findOne({
      'details.assetId': assetId,
      isDeleted: {$ne: true},
    });
    return Boolean(referencing);
  }

  async softDelete(assetId: string): Promise<boolean> {
    await this.init();
    if (!ObjectId.isValid(assetId)) return false;
    const result = await this.collection.updateOne(
      {_id: new ObjectId(assetId), isDeleted: {$ne: true}},
      {$set: {isDeleted: true, deletedAt: new Date(), updatedAt: new Date()}},
    );
    return result.modifiedCount === 1;
  }
}

/** Treat user input as literal text inside a regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
