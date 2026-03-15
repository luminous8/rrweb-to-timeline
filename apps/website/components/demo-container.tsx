import { type ReactNode } from "react";

interface DemoContainerProps {
  children: ReactNode;
}

export const DemoContainer = ({ children }: DemoContainerProps) => {
  return (
    <div className="relative w-full overflow-hidden rounded-xs border bg-muted dark:bg-background">
      {children}
    </div>
  );
};
