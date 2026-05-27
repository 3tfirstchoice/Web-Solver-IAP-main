import * as React from "react";
import { cn } from "@/lib/utils";

type ReactNode = React.ReactNode;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("rounded-3xl bg-white p-6 shadow-2xl", className)} {...props} />;
}

export function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={cn("text-2xl font-semibold tracking-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return <p className={cn("text-sm text-slate-500 leading-relaxed", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn("flex items-center justify-end gap-2 pt-4", className)} {...props} />;
}
