import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.ComponentPropsWithoutRef<'table'>) {
  return <table className={cn("w-full border-separate border-spacing-0 text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead className={cn(className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody className={cn(className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentPropsWithoutRef<'tr'>) {
  return <tr className={cn(className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentPropsWithoutRef<'th'>) {
  return <th className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.ComponentPropsWithoutRef<'td'>) {
  return <td className={cn("px-4 py-3 align-top text-sm text-slate-700", className)} {...props} />;
}
