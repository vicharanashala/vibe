import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Smile,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SupportDashboardStats } from '@/modules/supportChat/types';

interface StatsCardsProps {
  stats: SupportDashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Escalated',
      value: stats.escalated,
      icon: AlertTriangle,
      accent: 'text-amber-600 dark:text-amber-400',
      hint: 'The assistant could not answer these',
    },
    {
      title: 'Total questions',
      value: stats.totalQuestions,
      icon: MessageSquare,
      accent: 'text-primary',
    },
    {
      title: 'Answered',
      value: stats.answered,
      icon: CheckCircle2,
      accent: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle2,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Avg response time',
      value: `${stats.avgResolutionTime}m`,
      icon: Clock,
      accent: 'text-orange-600 dark:text-orange-400',
    },
    {
      title: 'Satisfaction',
      value: `${Math.round(stats.satisfactionRate || 0)}%`,
      icon: Smile,
      accent: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.title}>
            <CardContent className="flex items-start gap-4 p-4">
              <Icon className={`mt-1 h-7 w-7 shrink-0 ${card.accent}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
                {card.hint && (
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
