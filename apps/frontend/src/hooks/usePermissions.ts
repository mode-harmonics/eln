import { useEffect, useState } from "react";
import { hasPermission as checkPermission } from "@eln/shared";

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>(() => {
    const saved = localStorage.getItem("permissionList");
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("permissionList");
      try {
        setPermissions(saved ? JSON.parse(saved) : []);
      } catch {
        setPermissions([]);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("permissionsChanged", handleStorage);
    handleStorage();
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("permissionsChanged", handleStorage);
    };
  }, []);

  const hasPermission = (required: string): boolean => {
    return checkPermission(permissions, required);
  };

  return { permissions, hasPermission };
}
