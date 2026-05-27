import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.ComponentPropsWithoutRef<'hr'>) {
  return <hr className={cn("border-slate-200", className)} {...props} />;
}
