import { Lock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetAchievements, type Achievement, type AchievementTier } from '@/hooks/achievement-hooks';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/utils';

const TIER_CONFIG: Record<
  AchievementTier,
  { label: string; color: string; bgColor: string; borderColor: string; badgeVariant: string }
> = {
  BRONZE: {
    label: 'Bronze',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    badgeVariant: 'bg-amber-100 text-amber-800',
  },
  SILVER: {
    label: 'Silver',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    badgeVariant: 'bg-slate-100 text-slate-700',
  },
  GOLD: {
    label: 'Gold',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    badgeVariant: 'bg-yellow-100 text-yellow-800',
  },
  PLATINUM: {
    label: 'Platinum',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
    badgeVariant: 'bg-cyan-100 text-cyan-800',
  },
  DIAMOND: {
    label: 'Diamond',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    badgeVariant: 'bg-violet-100 text-violet-800',
  },
};

const TIER_EMOJI: Record<AchievementTier, string> = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💎',
  DIAMOND: '👑',
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const tier = TIER_CONFIG[achievement.tier];
  const emoji = TIER_EMOJI[achievement.tier];

  return (
    <Card
      className={cn(
        'relative transition-all duration-200',
        achievement.earned
          ? cn('border-2', tier.borderColor, tier.bgColor, 'shadow-md')
          : 'border border-gray-200 bg-gray-50 opacity-60',
      )}
    >
      {achievement.earned && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      )}
      {!achievement.earned && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-gray-400" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="text-4xl" role="img" aria-label={achievement.tier}>
            {emoji}
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle
              className={cn('text-base font-semibold', achievement.earned ? tier.color : 'text-gray-500')}
            >
              {achievement.title}
            </CardTitle>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', tier.badgeVariant)}>
              {tier.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
        <p className="text-xs text-gray-400">
          Requires {achievement.requiredCourseCount} course
          {achievement.requiredCourseCount !== 1 ? 's' : ''} completed
        </p>
        {achievement.earned && achievement.earnedAt && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            Earned on {new Date(achievement.earnedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AchievementCardSkeleton() {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-1 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4 mb-3" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

export default function StudentAchievements() {
  const user = useAuthStore(state => state.user);
  const { achievements, isLoading, error, refetch } = useGetAchievements(user?.uid ?? '');

  const earnedCount = achievements.filter(a => a.earned).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading
              ? 'Loading...'
              : `${earnedCount} of ${achievements.length} earned`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <AchievementCardSkeleton key={i} />)
          : achievements.map(achievement => (
              <AchievementCard key={achievement._id} achievement={achievement} />
            ))}
      </div>

      {!isLoading && achievements.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No achievements found</p>
          <p className="text-sm mt-1">Complete courses to start earning achievements.</p>
        </div>
      )}
    </div>
  );
}
