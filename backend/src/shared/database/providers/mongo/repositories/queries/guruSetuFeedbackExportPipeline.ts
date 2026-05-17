import { ObjectId } from 'mongodb';

const HHMMSS_TO_SECONDS = (path: string) => ({
  $let: {
    vars: {
      parts: { $split: [{ $ifNull: [path, '00:00:00'] }, ':'] },
    },
    in: {
      $add: [
        {
          $multiply: [
            {
              $convert: {
                input: { $arrayElemAt: ['$$parts', 0] },
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            3600,
          ],
        },
        {
          $multiply: [
            {
              $convert: {
                input: { $arrayElemAt: ['$$parts', 1] },
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            60,
          ],
        },
        {
          $convert: {
            input: { $arrayElemAt: ['$$parts', 2] },
            to: 'int',
            onError: 0,
            onNull: 0,
          },
        },
      ],
    },
  },
});

export function buildGuruSetuFeedbackExportPipeline(
  guruSetuCourseId: ObjectId,
  guruSetuVersionId: ObjectId,
  parsedCohortId: ObjectId | null,
): any[] {
  return [
    {
      $match: {
        courseId: guruSetuCourseId,
        courseVersionId: guruSetuVersionId,
        role: 'STUDENT',
        isDeleted: { $ne: true },
        ...(parsedCohortId ? { cohortId: parsedCohortId } : {}),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: { path: '$user', preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: 'newCourseVersion',
        let: { cvid: '$courseVersionId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$cvid'] } } },
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
          { $replaceRoot: { newRoot: '$video' } },
        ],
        as: 'videos',
      },
    },
    { $unwind: '$videos' },
    {
      $addFields: {
        videoId: '$videos._id',
        videoName: { $ifNull: ['$videos.name', '$videos.title'] },
        videoDurationSeconds: {
          $max: [
            0,
            {
              $subtract: [
                HHMMSS_TO_SECONDS('$videos.details.endTime'),
                HHMMSS_TO_SECONDS('$videos.details.startTime'),
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'watchTime',
        let: { uid: '$userId', vid: '$videoId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uid'] },
                  { $eq: ['$courseId', guruSetuCourseId] },
                  { $eq: ['$courseVersionId', guruSetuVersionId] },
                  { $ne: ['$endTime', null] },
                  { $ne: ['$isNotPure', true] },
                ],
              },
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
          { $match: { $expr: { $eq: ['$itemObjId', '$$vid'] } } },
          {
            $group: {
              _id: null,
              rawWatchedMs: { $sum: { $subtract: ['$endTime', '$startTime'] } },
              watchSessionCount: { $sum: 1 },
              firstWatchAt: { $min: '$startTime' },
              lastWatchAt: { $max: '$startTime' },
            },
          },
        ],
        as: 'watch',
      },
    },
    {
      $unwind: { path: '$watch', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        rawWatchedSeconds: {
          $let: {
            vars: {
              raw: {
                $round: [
                  {
                    $divide: [{ $ifNull: ['$watch.rawWatchedMs', 0] }, 1000],
                  },
                  2,
                ],
              },
            },
            in: {
              $cond: [
                { $gt: ['$videoDurationSeconds', 0] },
                { $min: ['$$raw', '$videoDurationSeconds'] },
                '$$raw',
              ],
            },
          },
        },
      },
    },
    {
      $addFields: {
        watchPercentage: {
          $cond: [
            { $gt: ['$videoDurationSeconds', 0] },
            {
              $round: [
                {
                  $multiply: [
                    { $divide: ['$rawWatchedSeconds', '$videoDurationSeconds'] },
                    100,
                  ],
                },
                2,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'feedback_submission',
        let: { uid: '$userId', vid: '$videoId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uid'] },
                  { $eq: ['$courseId', guruSetuCourseId] },
                  { $eq: ['$courseVersionId', guruSetuVersionId] },
                  { $eq: ['$previousItemId', '$$vid'] },
                  { $eq: ['$previousItemType', 'VIDEO'] },
                ],
              },
            },
          },
          { $sort: { updatedAt: -1, createdAt: -1, _id: -1 } },
          { $limit: 1 },
        ],
        as: 'feedbackSubmission',
      },
    },
    {
      $unwind: {
        path: '$feedbackSubmission',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'feedback_forms',
        localField: 'feedbackSubmission.feedbackFormId',
        foreignField: '_id',
        as: 'feedbackForm',
      },
    },
    {
      $unwind: {
        path: '$feedbackForm',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        userId: { $toString: '$userId' },
        userEmail: '$user.email',
        userFirstName: '$user.firstName',
        userLastName: '$user.lastName',
        videoName: 1,
        videoDurationSeconds: 1,
        rawWatchedSeconds: 1,
        watchPercentage: 1,
        watchSessionCount: { $ifNull: ['$watch.watchSessionCount', 0] },
        firstWatchAt: '$watch.firstWatchAt',
        lastWatchAt: '$watch.lastWatchAt',
        feedbackFormName: '$feedbackForm.name',
        'Was the explanation in the video clear?': {
          $getField: {
            field: 'Was the explanation in the video clear?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'How would you rate the Audio & Visual quality?': {
          $getField: {
            field: 'How would you rate the Audio & Visual quality?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'How was the pacing of the content in the video?': {
          $getField: {
            field: 'How was the pacing of the content in the video?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'Did the video hold your attention?': {
          $getField: {
            field: 'Did the video hold your attention?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'How useful do you find this content ?': {
          $getField: {
            field: 'How useful do you find this content ?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'How confident do you feel applying this concept in your daily/ professional life?': {
          $getField: {
            field:
              'How confident do you feel applying this concept in your daily/ professional life?',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        'Please share your feedback here': {
          $getField: {
            field: 'Please share your feedback here',
            input: { $ifNull: ['$feedbackSubmission.details', {}] },
          },
        },
        feedbackSubmittedAt: '$feedbackSubmission.createdAt',
      },
    },
    {
      $sort: {
        userEmail: 1,
        videoName: 1,
      },
    },
  ];
}
