import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("rounded-3xl bg-white", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) {
  return <h3 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return <p className={cn("text-sm text-slate-500 mt-1", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}
