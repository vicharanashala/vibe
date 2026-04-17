import { Card } from "@/components/ui/card";
import type { StatCardProps } from "@/types/ui.types";
import { cn } from "@/utils/utils";

// export const StatCard = ({ icon, value, label, className }: StatCardProps) => {
//   return (
//     <Card
//       className={`
//         bg-gradient-to-r from-[#ffecb3] to-[#ff9eb]
//         dark:bg-gradient-to-r dark:to-[#ff940880] dark:from-[#95122c80]
//         dark:text-white
//         text-black
//         shadow-lg
//         rounded-2xl
//         flex flex-row items-center p-4 gap-4
//         h-[100px]
//         w-full min-w-0 max-w-none
//         sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px]
//         transform hover:scale-105 transition-transform duration-300
//         ${className || ''}
//       `}
//     >
//       <div className="
//         bg-white/20
//         p-3
//         rounded-full
//         text-2xl
//         flex items-center justify-center
//       ">
//         {icon}
//       </div>
//       <div className="flex flex-col">
//         <div className="text-xl font-bold">{value}</div>
//         <div className="text-black dark:text-white text-sm">{label}</div>
//       </div>
//     </Card>
//   );
// };


export const StatCard = ({ icon, value, label, className }: StatCardProps) => {
  const isEnrolled = label.toLowerCase().includes("enrolled");
  
  return (
    <Card
      className={cn(
        "border p-5 rounded-[20px] flex flex-row items-center gap-5 h-[110px] w-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        isEnrolled 
          ? "bg-[#FFF5F8] border-[#FFD6E0] dark:bg-pink-950/20 dark:border-pink-900/30" 
          : "bg-[#F0F7FF] border-[#D1E9FF] dark:bg-blue-950/20 dark:border-blue-900/30",
        className
      )}
    >
      <div className={cn(
        "p-3 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
        isEnrolled ? "bg-white text-[#D97706]" : "bg-white text-[#EF4444]"
      )}>
        {icon}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
    </Card>
  );
};

