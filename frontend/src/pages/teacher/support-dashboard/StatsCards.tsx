import { MessageSquare, AlertCircle, CheckCircle2, Clock, Smile } from 'lucide-react';

interface Stats {
  totalQuestions: number;
  pending: number;
  answered: number;
  resolved: number;
  avgResolutionTime: number;
  satisfactionRate?: number;
}

interface StatsCardsProps {
  stats: Stats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Questions',
      value: stats.totalQuestions,
      icon: MessageSquare,
      color: 'blue',
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: AlertCircle,
      color: 'yellow',
    },
    {
      title: 'Answered',
      value: stats.answered,
      icon: CheckCircle2,
      color: 'green',
    },
    {
      title: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle2,
      color: 'emerald',
    },
    {
      title: 'Avg Response Time',
      value: `${stats.avgResolutionTime}m`,
      icon: Clock,
      color: 'orange',
    },
    {
      title: 'Satisfaction',
      value: `${Math.round(stats.satisfactionRate || 0)}%`,
      icon: Smile,
      color: 'purple',
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
      {cards.map((card) => {
        const Icon = card.icon;
        const colorClass = colorClasses[card.color];

        return (
          <div
            key={card.title}
            className={`${colorClass} border rounded-lg p-4 flex items-start gap-4`}
          >
            <Icon className='w-8 h-8 flex-shrink-0 mt-1' />
            <div className='flex-1'>
              <p className='text-sm font-medium opacity-75'>{card.title}</p>
              <p className='text-2xl font-bold'>{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
