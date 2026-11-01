import { cn } from "@/lib/utils";

export function CompletenessBar({
  percent,
  label,
  className,
}: {
  percent: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-28", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label ?? "Completeness"}
        aria-valuenow={Math.max(0, Math.min(100, percent))}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}
