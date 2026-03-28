import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb';
import { dbConfig } from '#root/config/db.js';

type MigrationOptions = {
  courseId: string;
  dryRun?: boolean;
  mongoUri?: string;
  dbName?: string;
  batchSize?: number;
};

type MigrationResult = {
  courseId: string;
  dryRun: boolean;
  versionsScanned: number;
  sectionsScanned: number;
  videoRefsScanned: number;
  legacyNamesMatched: number;
  updated: number;
  unchanged: number;
  skippedNoVideoDoc: number;
  skippedNoUrl: number;
  skippedNotYoutube: number;
  skippedNoTitle: number;
  failed: number;
};

type CourseVersionDoc = {
  _id: ObjectId;
  courseId: ObjectId;
  modules?: Array<{
    moduleId: ObjectId;
    sections?: Array<{
      sectionId: ObjectId;
      itemsGroupId: ObjectId;
    }>;
  }>;
};

type ItemRefDoc = {
  _id: ObjectId;
  type: string;
  order: string;
};

type ItemsGroupDoc = {
  _id: ObjectId;
  items: ItemRefDoc[];
};

type VideoDoc = {
  _id: ObjectId;
  name?: string;
  description?: string;
  details?: {
    URL?: string;
  };
  isDeleted?: boolean;
};

type CandidateUpdate = {
  videoId: ObjectId;
  derivedPartNumber: number;
};

const LEGACY_VIDEO_ITEM_NAME_REGEX = /^video[\s_-]*item(?:\s*-\s*part\s*(\d+))?$/i;
const LEGACY_CSV_VIDEO_NAME_REGEX = /^video\s+(\d+)$/i;
const LEGACY_CSV_VIDEO_DESCRIPTION_REGEX = /^video segment\s+\d+\s+from csv upload$/i;
const YOUTUBE_OEMBED_URL = 'https://www.youtube.com/oembed';

function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'www.youtu.be'
    );
  } catch {
    return false;
  }
}

function parsePartNumberFromLegacyName(name?: string): number | null {
  if (!name) {
    return null;
  }

  const trimmed = name.trim();

  const videoItemMatch = trimmed.match(LEGACY_VIDEO_ITEM_NAME_REGEX);
  if (videoItemMatch) {
    const parsed = Number(videoItemMatch[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    return null;
  }

  const csvMatch = trimmed.match(LEGACY_CSV_VIDEO_NAME_REGEX);
  if (!csvMatch) {
    return null;
  }

  const parsed = Number(csvMatch[1]);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

function isLegacyGeneratedVideo(video: Pick<VideoDoc, 'name' | 'description'>): boolean {
  const name = (video.name || '').trim();
  const description = (video.description || '').trim();

  if (LEGACY_VIDEO_ITEM_NAME_REGEX.test(name)) {
    return true;
  }

  return (
    LEGACY_CSV_VIDEO_NAME_REGEX.test(name) &&
    LEGACY_CSV_VIDEO_DESCRIPTION_REGEX.test(description)
  );
}

async function fetchYoutubeTitle(url: string): Promise<string | null> {
  try {
    const response = await axios.get(YOUTUBE_OEMBED_URL, {
      params: {
        url,
        format: 'json',
      },
      timeout: 10_000,
    });

    const title = response?.data?.title;
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }

    return null;
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]): {
  courseId?: string;
  dryRun: boolean;
  batchSize?: number;
} {
  const execute = argv.includes('--execute');
  const dryRun = !execute;

  const courseArg = argv.find(arg => arg.startsWith('--course-id='));
  const courseId = courseArg?.split('=')[1]?.trim();

  const batchArg = argv.find(arg => arg.startsWith('--batch-size='));
  const batchValue = batchArg ? Number(batchArg.split('=')[1]) : undefined;
  const batchSize =
    typeof batchValue === 'number' && Number.isInteger(batchValue) && batchValue > 0
      ? batchValue
      : undefined;

  return {
    courseId,
    dryRun,
    batchSize,
  };
}

export async function backfillLegacyVideoNamesForCourse(
  options: MigrationOptions,
): Promise<MigrationResult> {
  const mongoUri = options.mongoUri ?? dbConfig.url;
  const dbName = options.dbName ?? dbConfig.dbName;
  const dryRun = options.dryRun ?? true;
  const batchSize = options.batchSize ?? 200;

  if (!mongoUri) {
    throw new Error('DB_URL is required to run video name backfill migration.');
  }

  if (!options.courseId) {
    throw new Error('--course-id is required.');
  }

  if (!ObjectId.isValid(options.courseId)) {
    throw new Error(`Invalid course id: ${options.courseId}`);
  }

  const courseObjectId = new ObjectId(options.courseId);
  const client = new MongoClient(mongoUri, {
    maxPoolSize: 10,
    connectTimeoutMS: 20_000,
  });

  const result: MigrationResult = {
    courseId: options.courseId,
    dryRun,
    versionsScanned: 0,
    sectionsScanned: 0,
    videoRefsScanned: 0,
    legacyNamesMatched: 0,
    updated: 0,
    unchanged: 0,
    skippedNoVideoDoc: 0,
    skippedNoUrl: 0,
    skippedNotYoutube: 0,
    skippedNoTitle: 0,
    failed: 0,
  };

  const titleCache = new Map<string, string | null>();

  try {
    await client.connect();
    const db = client.db(dbName);

    const versions = db.collection<CourseVersionDoc>('newCourseVersion');
    const itemsGroupCollection = db.collection<ItemsGroupDoc>('itemsGroup');
    const videosCollection = db.collection<VideoDoc>('videos');

    const versionDocs = await versions
      .find(
        {
          courseId: courseObjectId,
          isDeleted: { $ne: true },
        },
        {
          projection: {
            _id: 1,
            courseId: 1,
            modules: 1,
          },
        },
      )
      .toArray();

    result.versionsScanned = versionDocs.length;

    const candidateUpdates: CandidateUpdate[] = [];

    for (const versionDoc of versionDocs) {
      const modules = versionDoc.modules || [];

      for (const moduleDoc of modules) {
        const sections = moduleDoc.sections || [];
        result.sectionsScanned += sections.length;

        for (const sectionDoc of sections) {
          const itemsGroup = await itemsGroupCollection.findOne({
            _id: new ObjectId(sectionDoc.itemsGroupId),
          });

          if (!itemsGroup?.items?.length) {
            continue;
          }

          const sortedItems = [...itemsGroup.items].sort((a, b) =>
            String(a.order || '').localeCompare(String(b.order || '')),
          );

          const partByVideoId = new Map<string, number>();
          const perUrlCounter = new Map<string, number>();

          const videoIds = sortedItems
            .filter(item => item.type === 'VIDEO' && item._id)
            .map(item => new ObjectId(item._id));

          if (videoIds.length === 0) {
            continue;
          }

          const sectionVideos = await videosCollection
            .find(
              {
                _id: { $in: videoIds },
                isDeleted: { $ne: true },
              },
              {
                projection: {
                  _id: 1,
                  name: 1,
                  description: 1,
                  'details.URL': 1,
                },
              },
            )
            .toArray();

          const videoById = new Map(sectionVideos.map(video => [video._id.toString(), video]));

          for (const itemRef of sortedItems) {
            if (itemRef.type !== 'VIDEO' || !itemRef._id) {
              continue;
            }

            result.videoRefsScanned += 1;

            const videoDoc = videoById.get(itemRef._id.toString());
            if (!videoDoc) {
              result.skippedNoVideoDoc += 1;
              continue;
            }

            const url = videoDoc.details?.URL?.trim() || '';
            if (url) {
              const next = (perUrlCounter.get(url) || 0) + 1;
              perUrlCounter.set(url, next);
              partByVideoId.set(videoDoc._id.toString(), next);
            }

            const explicitPart = parsePartNumberFromLegacyName(videoDoc.name);
            if (!isLegacyGeneratedVideo(videoDoc)) {
              continue;
            }

            result.legacyNamesMatched += 1;

            const derivedPartNumber = explicitPart || partByVideoId.get(videoDoc._id.toString()) || 1;
            candidateUpdates.push({
              videoId: videoDoc._id,
              derivedPartNumber,
            });
          }
        }
      }
    }

    for (let index = 0; index < candidateUpdates.length; index += batchSize) {
      const slice = candidateUpdates.slice(index, index + batchSize);
      const ids = slice.map(item => item.videoId);
      const videos = await videosCollection
        .find(
          {
            _id: { $in: ids },
            isDeleted: { $ne: true },
          },
          {
            projection: {
              _id: 1,
              name: 1,
              description: 1,
              'details.URL': 1,
            },
          },
        )
        .toArray();

      const videoById = new Map(videos.map(video => [video._id.toString(), video]));
      const operations: Array<{ updateOne: { filter: { _id: ObjectId }; update: { $set: { name: string; updatedAt: Date } } } }> = [];

      for (const candidate of slice) {
        const videoDoc = videoById.get(candidate.videoId.toString());
        if (!videoDoc) {
          result.skippedNoVideoDoc += 1;
          continue;
        }

        const url = videoDoc.details?.URL?.trim();
        if (!url) {
          result.skippedNoUrl += 1;
          continue;
        }

        if (!isYoutubeUrl(url)) {
          result.skippedNotYoutube += 1;
          continue;
        }

        let youtubeTitle: string | null;
        if (titleCache.has(url)) {
          youtubeTitle = titleCache.get(url) || null;
        } else {
          youtubeTitle = await fetchYoutubeTitle(url);
          titleCache.set(url, youtubeTitle);
        }

        if (!youtubeTitle) {
          result.skippedNoTitle += 1;
          continue;
        }

        const nextName = `${youtubeTitle} - Part ${candidate.derivedPartNumber}`;
        if ((videoDoc.name || '').trim() === nextName) {
          result.unchanged += 1;
          continue;
        }

        operations.push({
          updateOne: {
            filter: { _id: candidate.videoId },
            update: {
              $set: {
                name: nextName,
                updatedAt: new Date(),
              },
            },
          },
        });
      }

      if (dryRun) {
        result.updated += operations.length;
        continue;
      }

      if (operations.length === 0) {
        continue;
      }

      const writeResult = await videosCollection.bulkWrite(operations, {
        ordered: false,
      });
      result.updated += writeResult.modifiedCount;
    }

    return result;
  } catch (error) {
    result.failed += 1;
    throw error;
  } finally {
    await client.close();
  }
}

async function runFromCli() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.courseId) {
    throw new Error('Usage: --course-id=<COURSE_ID> [--execute] [--batch-size=200]');
  }

  const summary = await backfillLegacyVideoNamesForCourse({
    courseId: parsed.courseId,
    dryRun: parsed.dryRun,
    batchSize: parsed.batchSize,
  });

  console.log('[VideoNameBackfillMigration] complete');
  console.log(`courseId=${summary.courseId}`);
  console.log(`dryRun=${summary.dryRun}`);
  console.log(`versionsScanned=${summary.versionsScanned}`);
  console.log(`sectionsScanned=${summary.sectionsScanned}`);
  console.log(`videoRefsScanned=${summary.videoRefsScanned}`);
  console.log(`legacyNamesMatched=${summary.legacyNamesMatched}`);
  console.log(`updated=${summary.updated}`);
  console.log(`unchanged=${summary.unchanged}`);
  console.log(`skippedNoVideoDoc=${summary.skippedNoVideoDoc}`);
  console.log(`skippedNoUrl=${summary.skippedNoUrl}`);
  console.log(`skippedNotYoutube=${summary.skippedNotYoutube}`);
  console.log(`skippedNoTitle=${summary.skippedNoTitle}`);
  console.log(`failed=${summary.failed}`);

  if (summary.dryRun) {
    console.log('Run with --execute to apply updates.');
  }
}

runFromCli().catch(error => {
  console.error('[VideoNameBackfillMigration] failed');
  console.error(error);
  process.exitCode = 1;
});
