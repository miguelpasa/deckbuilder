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
        <span className="font-medium tabular-nums">{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}
