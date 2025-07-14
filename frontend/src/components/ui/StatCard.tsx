import { Card } from "@/components/ui/card";
import type { StatCardProps } from "@/types/ui.types";

export const StatCard = ({ icon, value, label, className }: StatCardProps) => {
  return (
    <Card
      className={`
        bg-gradient-to-r from-[#ffecb3] to-[#ff9eb]
        dark:bg-gradient-to-r dark:to-[#ff940880] dark:from-[#95122c80]
        dark:text-white
        text-black
        shadow-lg
        rounded-2xl
        flex flex-row items-center p-4 gap-4
        w-[180px] h-[100px]
        min-w-[180px] max-w-[180px]
        min-h-[100px] max-h-[100px]
        transform hover:scale-105 transition-transform duration-300
        ${className || ''}
      `}
    >
      <div className="
        bg-white/20
        p-3
        rounded-full
        text-2xl
        flex items-center justify-center
      ">
        {icon}
      </div>
      <div className="flex flex-col">
        <div className="text-xl font-bold">{value}</div>
        <div className="text-black dark:text-white text-sm">{label}</div>
      </div>
    </Card>
  );
};
