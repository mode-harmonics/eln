import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface PageLoaderProps {
  className?: string;
  iconClassName?: string;
}

export function PageLoader({ className, iconClassName }: PageLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center py-24", className)}>
      <Loader2 className={cn("w-6 h-6 animate-spin text-gray-500", iconClassName)} />
    </div>
  );
}
