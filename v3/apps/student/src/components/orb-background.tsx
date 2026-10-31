import { cn } from "@/lib/utils";

export default function OrbBackground({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] pointer-events-none",
        className
      )}
      style={{
        background: "radial-gradient(circle at center, var(--orb-color-light) 0%, var(--orb-color-dark-fade) 60%, transparent 100%)",
        filter: "blur(60px)",
        zIndex: 0,
      }}
    />
  );
}
