import * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const ScrollArea = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("overflow-auto", className)} {...props} />
  ),
);

ScrollArea.displayName = "ScrollArea";
