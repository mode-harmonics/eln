import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { CellGroupDto, CellGroupAssignment } from "@eln/shared";

interface UseGroupsResult {
  groups: CellGroupDto[];
  loading: boolean;
  error: string | null;
  getCellGroup: (cellIdentifier: string) => CellGroupAssignment;
  refresh: () => void;
}

const groupAssignmentCache = new Map<string, CellGroupAssignment>();

/**
 * Manages cell groups for a given project.
 * Caches the group assignments for quick lookup by cell identifier.
 */
export function useGroups(projectId: string | undefined): UseGroupsResult {
  const [groups, setGroups] = useState<CellGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    api.get<CellGroupDto[]>(`/api/v1/projects/${projectId}/groups`)
      .then((data) => {
        if (cancelled) return;
        setGroups(data);
        // Rebuild cache from fresh data
        groupAssignmentCache.clear();
        for (const g of data) {
          groupAssignmentCache.set(`group:${g.id}`, {
            groupId: g.id,
            groupName: g.name,
            color: g.color,
          });
        }
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Failed to load groups");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  const getCellGroup = useCallback(
    (cellIdentifier: string): CellGroupAssignment => {
      // This is a client-side lookup stub; the real resolution happens server-side.
      // The frontend receives groupMap from the API response with ?withGroups=true.
      return groupAssignmentCache.get(cellIdentifier) ?? {
        groupId: null,
        groupName: null,
        color: "#9ca3af",
      };
    },
    [],
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    groupAssignmentCache.clear();
  }, []);

  return { groups, loading, error, getCellGroup, refresh };
}
