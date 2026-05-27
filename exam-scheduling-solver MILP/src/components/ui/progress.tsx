import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<'div'> {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className, ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className={cn("w-full rounded-full bg-slate-100 overflow-hidden", className)} {...props}>
      <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${percentage}%`, minWidth: '2px', height: '100%' }} />
    </div>
  );
}
