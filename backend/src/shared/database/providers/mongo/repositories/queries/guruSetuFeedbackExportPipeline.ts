import { ObjectId } from 'mongodb';

const HHMMSS_TO_SECONDS = (path: string) => ({
  $let: {
    vars: {
      parts: { $split: [{ $ifNull: [path, '00:00:00'] }, ':'] },
    },
    in: {
      $let: {
        vars: {
          numParts: { $size: '$$parts' },
          p0: {
            $convert: {
              input: { $arrayElemAt: ['$$parts', 0] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
          p1: {
            $convert: {
              input: { $arrayElemAt: ['$$parts', 1] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
          p2: {
            $convert: {
              input: { $arrayElemAt: ['$$parts', 2] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
        },
        in: {
          $switch: {
            branches: [
              {
                // HH:MM:SS
                case: { $eq: ['$$numParts', 3] },
                then: {
                  $add: [
                    { $multiply: ['$$p0', 3600] },
                    { $multiply: ['$$p1', 60] },
                    '$$p2',
                  ],
                },
              },
              {
                // MM:SS
                case: { $eq: ['$$numParts', 2] },
                then: { $add: [{ $multiply: ['$$p0', 60] }, '$$p1'] },
              },
              {
                // SS only
                case: { $eq: ['$$numParts', 1] },
                then: '$$p0',
              },
            ],
            default: 0,
          },
        },
      },
    },
  },
});

/**
 * Extracts the VIDEO items for a course version ONCE (the video list is identical
 * for every enrolled student). Returns one document per video with the fields the
 * export needs: { videoId, videoName, videoDurationSeconds }.
 */
export function buildGuruSetuVideoListPipeline(
  guruSetuVersionId: ObjectId,
): any[] {
  return [
    { $match: { _id: guruSetuVersionId } },
    { $unwind: '$modules' },
    { $match: { 'modules.isDeleted': { $ne: true } } },
    { $unwind: '$modules.sections' },
    { $match: { 'modules.sections.isDeleted': { $ne: true } } },
    {
      $lookup: {
        from: 'itemsGroup',
        let: { igId: '$modules.sections.itemsGroupId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$_id', { $toObjectId: '$$igId' }] },
            },
          },
        ],
        as: 'itemGroup',
      },
    },
    { $unwind: '$itemGroup' },
    { $unwind: '$itemGroup.items' },
    {
      $match: {
        'itemGroup.items.type': 'VIDEO',
        'itemGroup.items.isHidden': { $ne: true },
        'itemGroup.items.isDeleted': { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'videos',
        let: { itemId: '$itemGroup.items._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', { $toObjectId: '$$itemId' }] },
                  { $ne: ['$isDeleted', true] },
                  { $ne: ['$isHidden', true] },
                ],
              },
            },
          },
        ],
        as: 'video',
      },
    },
    { $unwind: '$video' },
    {
      $project: {
        _id: 0,
        videoId: '$video._id',
        videoName: { $ifNull: ['$video.name', '$video.title'] },
        videoDurationSeconds: {
          $max: [
            0,
            {
              $subtract: [
                HHMMSS_TO_SECONDS('$video.details.endTime'),
                HHMMSS_TO_SECONDS('$video.details.startTime'),
              ],
            },
          ],
        },
      },
    },
  ];
}

/**
 * Aggregates watch time for the given students in ONE pass (indexed by userId),
 * grouped by (userId, itemId).
 *
 * watchTime stores only startTime/endTime per session (no played-duration, no
 * idle flag), so a session's wall-clock span includes idle time when a tab is left
 * open. To stop a single left-open session from inflating the total, EACH session
 * is clamped to at most its video's duration before summing. Genuine rewatches
 * still accumulate across sessions (so the summed % can exceed 100%).
 *
 * `videoDurations` maps each video item to its duration in seconds and is injected
 * as a literal so the clamp can be applied inside the aggregation.
 */
export function buildGuruSetuWatchAggPipeline(
  guruSetuVersionId: ObjectId,
  userIds: ObjectId[],
  videoDurations: { itemId: ObjectId; durationSeconds: number }[],
): any[] {
  return [
    {
      $match: {
        userId: { $in: userIds },
        courseVersionId: {
          $in: [guruSetuVersionId, guruSetuVersionId.toString()],
        },
        endTime: { $ne: null },
      },
    },
    {
      $addFields: {
        itemObjId: {
          $cond: [
            { $eq: [{ $type: '$itemId' }, 'string'] },
            {
              $convert: {
                input: '$itemId',
                to: 'objectId',
                onError: null,
                onNull: null,
              },
            },
            '$itemId',
          ],
        },
      },
    },
    {
      $addFields: {
        sessionSeconds: {
          $let: {
            vars: {
              raw: {
                $divide: [{ $subtract: ['$endTime', '$startTime'] }, 1000],
              },
              dur: {
                $let: {
                  vars: {
                    match: {
                      $first: {
                        $filter: {
                          input: videoDurations,
                          as: 'v',
                          cond: { $eq: ['$$v.itemId', '$itemObjId'] },
                        },
                      },
                    },
                  },
                  in: '$$match.durationSeconds',
                },
              },
            },
            in: {
              $cond: [
                { $and: [{ $ne: ['$$dur', null] }, { $gt: ['$$dur', 0] }] },
                { $min: ['$$raw', '$$dur'] },
                '$$raw',
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: { userId: '$userId', itemId: '$itemObjId' },
        rawWatchedSeconds: { $sum: '$sessionSeconds' },
        watchSessionCount: { $sum: 1 },
        firstWatchAt: { $min: '$startTime' },
        lastWatchAt: { $max: '$startTime' },
      },
    },
  ];
}

/**
 * Picks the latest feedback submission per (userId, video) for the given students
 * in ONE pass. Returns the submission details, form id, and submission time.
 */
export function buildGuruSetuFeedbackAggPipeline(
  guruSetuVersionId: ObjectId,
  userIds: ObjectId[],
): any[] {
  return [
    {
      $match: {
        userId: { $in: userIds },
        courseVersionId: {
          $in: [guruSetuVersionId, guruSetuVersionId.toString()],
        },
        previousItemType: 'VIDEO',
      },
    },
    { $sort: { updatedAt: -1, createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: { userId: '$userId', itemId: '$previousItemId' },
        details: { $first: '$details' },
        feedbackFormId: { $first: '$feedbackFormId' },
        createdAt: { $first: '$createdAt' },
      },
    },
  ];
}
