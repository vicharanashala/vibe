import {IAchievement} from '#root/shared/interfaces/models.js';

export const ACHIEVEMENT_DEFINITIONS: Omit<IAchievement, '_id'>[] = [
  {
    slug: 'first_step',
    title: 'First Step',
    description: 'Complete your first course.',
    tier: 'BRONZE',
    requiredCourseCount: 1,
    badgeKey: 'first-step',
    createdAt: new Date('2024-01-01'),
  },
  {
    slug: 'on_a_roll',
    title: 'On a Roll',
    description: 'Complete 3 courses.',
    tier: 'SILVER',
    requiredCourseCount: 3,
    badgeKey: 'on-a-roll',
    createdAt: new Date('2024-01-01'),
  },
  {
    slug: 'dedicated_learner',
    title: 'Dedicated Learner',
    description: 'Complete 5 courses.',
    tier: 'GOLD',
    requiredCourseCount: 5,
    badgeKey: 'dedicated-learner',
    createdAt: new Date('2024-01-01'),
  },
  {
    slug: 'knowledge_seeker',
    title: 'Knowledge Seeker',
    description: 'Complete 10 courses.',
    tier: 'PLATINUM',
    requiredCourseCount: 10,
    badgeKey: 'knowledge-seeker',
    createdAt: new Date('2024-01-01'),
  },
  {
    slug: 'master_learner',
    title: 'Master Learner',
    description: 'Complete 25 courses.',
    tier: 'DIAMOND',
    requiredCourseCount: 25,
    badgeKey: 'master-learner',
    createdAt: new Date('2024-01-01'),
  },
];
