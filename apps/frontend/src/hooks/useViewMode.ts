import { useState, useEffect } from "react";

export function useViewMode(storageKey: string, defaultMode: "grid" | "list" = "grid") {
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(storageKey) as "grid" | "list") || defaultMode
  );

  useEffect(() => {
    localStorage.setItem(storageKey, viewMode);
  }, [viewMode, storageKey]);

  return [viewMode, setViewMode] as const;
}
