import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "./SegmentedControl";

interface ViewToggleProps {
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  className?: string;
}

export function ViewToggle({ viewMode, setViewMode, className }: ViewToggleProps) {
  return (
    <SegmentedControl
      items={[
        { value: "grid", label: "Grid view", icon: <LayoutGrid className="h-4 w-4" />, title: "Grid view" },
        { value: "list", label: "List view", icon: <List className="h-4 w-4" />, title: "List view" },
      ]}
      value={viewMode}
      onValueChange={setViewMode}
      size="sm"
      iconOnly
      className={className}
    />
  );
}
