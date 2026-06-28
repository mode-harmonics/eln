import { useEffect, useState } from "react";

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
    if (!permissions || permissions.length === 0) return false;
    const [resource, action] = required.split(":");
    return permissions.some((p) => {
      if (p === "*" || p === `${resource}:*` || p === required) return true;
      return false;
    });
  };

  return { permissions, hasPermission };
}
