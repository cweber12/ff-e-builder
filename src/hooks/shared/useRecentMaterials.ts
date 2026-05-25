import { useCallback, useEffect, useState } from 'react';

const MAX_RECENT = 10;

function storageKey(projectId: string) {
  return `ffe-recent-materials-${projectId}`;
}

function readIds(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(projectId: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(ids));
  } catch {
    // ignore quota / private-browsing errors
  }
}

export function useRecentMaterials(projectId: string): {
  recentIds: string[];
  push: (materialId: string) => void;
} {
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds(projectId));

  useEffect(() => {
    setRecentIds(readIds(projectId));
  }, [projectId]);

  const push = useCallback(
    (materialId: string) => {
      const current = readIds(projectId);
      const next = [materialId, ...current.filter((id) => id !== materialId)].slice(0, MAX_RECENT);
      writeIds(projectId, next);
      setRecentIds(next);
    },
    [projectId],
  );

  return { recentIds, push };
}
