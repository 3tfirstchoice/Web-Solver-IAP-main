import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentPropsWithoutRef<'span'> & {
  variant?: "default" | "outline" | "secondary";
  className?: string;
  children?: React.ReactNode;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-slate-100 text-slate-800 border border-slate-200",
    outline: "bg-transparent text-slate-700 border border-slate-200",
    secondary: "bg-slate-200 text-slate-700 border border-slate-200",
  };

  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variantClasses[variant], className)} {...props} />;
}
