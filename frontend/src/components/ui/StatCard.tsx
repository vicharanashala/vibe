import { Card } from "@/components/ui/card";
import type { StatCardProps } from "@/types/ui.types";

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
  return (
    <Card
      className={`
        border border-border
       bg-gradient-to-r from-[#ffecb3] to-[#ff9eb]
        dark:bg-gradient-to-r dark:to-[#ff940880] dark:from-[#95122c80]
        dark:text-white
        text-black
        rounded-2xl
        flex flex-row items-center p-5 gap-4
        h-[110px]
        w-full
        hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200
        ${className || ""}
      `}
    >
      <div className="bg-white/40 dark:bg-primary/25 p-3 rounded-xl flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground truncate">{label}</span>
      </div>
    </Card>
  );
};

