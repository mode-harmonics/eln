import { LayoutGrid, List } from "lucide-react";
import { cn } from "../lib/utils";

interface ViewToggleProps {
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  className?: string;
}

export function ViewToggle({ viewMode, setViewMode, className }: ViewToggleProps) {
  return (
    <div className={cn("flex items-center bg-gray-100/80 rounded-lg p-0.5 border border-gray-200/60", className)}>
      <button 
        onClick={() => setViewMode("grid")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center", 
          viewMode === "grid" 
            ? "bg-white shadow-sm text-gray-900" 
            : "text-gray-500 hover:text-gray-800"
        )}
        title="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button 
        onClick={() => setViewMode("list")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center", 
          viewMode === "list" 
            ? "bg-white shadow-sm text-gray-900" 
            : "text-gray-500 hover:text-gray-800"
        )}
        title="List view"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}
