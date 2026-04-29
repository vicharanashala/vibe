import { ObjectId } from 'mongodb';

export function buildGuruSetuFeedbackExportPipeline(
  guruSetuCourseId: ObjectId,
  guruSetuVersionId: ObjectId,
  parsedCohortId: ObjectId | null,
): any[] {
  return [
    // 1. Start from all enrolled students
    {
      $match: {
        courseId: guruSetuCourseId,
        courseVersionId: guruSetuVersionId,
        role: 'STUDENT',
        isDeleted: { $ne: true },
        ...(parsedCohortId ? { cohortId: parsedCohortId } : {}),
      },
    },
    // 2. Lookup user details
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $addFields: {
        userEmail: '$user.email',
      },
    },
    // 3. Lookup watch time per video for this user in this course
    {
      $lookup: {
        from: 'watchTime',
        let: { uid: '$userId' },
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
          { $match: { itemObjId: { $ne: null } } },
          {
            $group: {
              _id: '$itemObjId',
              rawWatchedMs: { $sum: { $subtract: ['$endTime', '$startTime'] } },
              watchSessionCount: { $sum: 1 },
              firstWatchAt: { $min: '$startTime' },
              lastWatchAt: { $max: '$startTime' },
            },
          },
        ],
        as: 'watchGroups',
      },
    },
    // 4. One row per watched video; students with no watch data get one row with null watchGroup
    {
      $unwind: {
        path: '$watchGroups',
        preserveNullAndEmptyArrays: true,
      },
    },
    // 5. Lookup video details by watchGroups._id
    {
      $lookup: {
        from: 'videos',
        localField: 'watchGroups._id',
        foreignField: '_id',
        as: 'video',
      },
    },
    {
      $unwind: {
        path: '$video',
        preserveNullAndEmptyArrays: true,
      },
    },
    // 6. Compute video duration, raw watched seconds, and watchPercent
    {
      $addFields: {
        videoId: '$watchGroups._id',
        videoName: { $ifNull: ['$video.name', '$video.title'] },
        videoDurationSeconds: {
          $let: {
            vars: {
              startParts: {
                $split: [{ $ifNull: ['$video.details.startTime', '00:00:00'] }, ':'],
              },
              endParts: {
                $split: [{ $ifNull: ['$video.details.endTime', '00:00:00'] }, ':'],
              },
            },
            in: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $convert: {
                                input: { $arrayElemAt: ['$$endParts', 0] },
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
                                input: { $arrayElemAt: ['$$endParts', 1] },
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
                            input: { $arrayElemAt: ['$$endParts', 2] },
                            to: 'int',
                            onError: 0,
                            onNull: 0,
                          },
                        },
                      ],
                    },
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $convert: {
                                input: { $arrayElemAt: ['$$startParts', 0] },
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
                                input: { $arrayElemAt: ['$$startParts', 1] },
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
                            input: { $arrayElemAt: ['$$startParts', 2] },
                            to: 'int',
                            onError: 0,
                            onNull: 0,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        rawWatchedSecondsUncapped: {
          $round: [
            { $divide: [{ $ifNull: ['$watchGroups.rawWatchedMs', 0] }, 1000] },
            2,
          ],
        },
      },
    },
    {
      $addFields: {
        rawWatchedSeconds: {
          $min: ['$rawWatchedSecondsUncapped', '$videoDurationSeconds'],
        },
        watchPercent: {
          $cond: {
            if: { $gt: ['$videoDurationSeconds', 0] },
            then: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        { $min: ['$rawWatchedSecondsUncapped', '$videoDurationSeconds'] },
                        '$videoDurationSeconds',
                      ],
                    },
                    100,
                  ],
                },
                2,
              ],
            },
            else: null,
          },
        },
      },
    },
    // 7. Lookup feedback submission (left join — null if no feedback)
    {
      $lookup: {
        from: 'feedback_submission',
        let: {
          uid: '$userId',
          vid: '$videoId',
        },
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
          {
            $group: {
              _id: {
                userId: '$userId',
                feedbackFormId: '$feedbackFormId',
                previousItemId: '$previousItemId',
              },
              doc: { $first: '$$ROOT' },
            },
          },
          { $replaceRoot: { newRoot: '$doc' } },
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
    // 8. Project final columns
    {
      $project: {
        _id: 0,
        userId: { $toString: '$userId' },
        userEmail: 1,
        videoName: 1,
        videoDurationSeconds: 1,
        rawWatchedSeconds: 1,
        rawWatchedSecondsUncapped: 1,
        watchSessionCount: '$watchGroups.watchSessionCount',
        watchPercent: 1,
        firstWatchAt: '$watchGroups.firstWatchAt',
        lastWatchAt: '$watchGroups.lastWatchAt',
        details: '$feedbackSubmission.details',
        feedbackFormName: '$feedbackForm.name',
        'Was the explanation in the video clear?': {
          $getField: {
            field: 'Was the explanation in the video clear?',
            input: '$feedbackSubmission.details',
          },
        },
        'How would you rate the Audio & Visual quality?': {
          $getField: {
            field: 'How would you rate the Audio & Visual quality?',
            input: '$feedbackSubmission.details',
          },
        },
        'How was the pacing of the content in the video?': {
          $getField: {
            field: 'How was the pacing of the content in the video?',
            input: '$feedbackSubmission.details',
          },
        },
        'Did the video hold your attention?': {
          $getField: {
            field: 'Did the video hold your attention?',
            input: '$feedbackSubmission.details',
          },
        },
        'How useful do you find this content ?': {
          $getField: {
            field: 'How useful do you find this content ?',
            input: '$feedbackSubmission.details',
          },
        },
        'How confident do you feel applying this concept in your daily/ professional life?': {
          $getField: {
            field:
              'How confident do you feel applying this concept in your daily/ professional life?',
            input: '$feedbackSubmission.details',
          },
        },
        'Please share your feedback here': {
          $getField: {
            field: 'Please share your feedback here',
            input: '$feedbackSubmission.details',
          },
        },
        createdAt: '$feedbackSubmission.createdAt',
      },
    },
    {
      $sort: {
        userEmail: 1,
        videoName: 1,
        createdAt: -1,
      },
    },
  ];
}
