import { Card } from "@/components/ui/card";

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  className?: string;
}

export const StatCard = ({ icon, value, label, className }: StatCardProps) => {
  return (
    <Card className={`border border-border flex flex-row items-center p-4 gap-4 py-0 student-card-hover bg-secondary/50 w-[180px] h-[100px] min-w-[180px] max-w-[180px] min-h-[100px] max-h-[100px] ${className || ''}`}>
      <div className="text-2xl flex items-center justify-center">{icon}</div>
      <div className="flex flex-col">
        <div className="text-xl font-bold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </Card>
  );
};
