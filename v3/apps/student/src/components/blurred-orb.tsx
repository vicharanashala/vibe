import { cn } from "@/lib/utils";

export default function BlurredOrb({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "w-16 h-16 bg-gradient-to-b from-primary to-secondary rounded-full blur-3xl",
        className
      )}
      style={style}
    />
  );
}
