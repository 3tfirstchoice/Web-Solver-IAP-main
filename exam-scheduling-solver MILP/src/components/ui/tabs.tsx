import * as React from "react";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

type TabsProps = React.ComponentPropsWithoutRef<'div'> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({ defaultValue, value, onValueChange, className, children, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value ?? internalValue;

  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

type TabsTriggerProps = React.ComponentPropsWithoutRef<'button'> & {
  value: string;
};

export function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within a Tabs component.");
  }

  const active = context.value === value;
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-100",
        className,
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

type TabsContentProps = React.ComponentPropsWithoutRef<'div'> & {
  value: string;
};

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within a Tabs component.");
  }

  if (context.value !== value) {
    return null;
  }

  return (
    <div className={cn("pt-4", className)} {...props}>
      {children}
    </div>
  );
}
