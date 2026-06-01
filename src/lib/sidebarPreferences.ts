export type SidebarToolContext = 'ffe' | 'proposal' | 'plans' | 'materials' | 'budget';

const SIDEBAR_PREFERENCES_STORAGE_KEY = 'ffe-builder:project-tab-sidebar';

function resolvePreferenceMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  const raw = window.localStorage.getItem(SIDEBAR_PREFERENCES_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}

function preferenceKey(projectId: string, tool: SidebarToolContext): string {
  return `${projectId}:${tool}`;
}

export function readSidebarCollapsedPreference(
  projectId: string,
  tool: SidebarToolContext,
): boolean | null {
  const value = resolvePreferenceMap()[preferenceKey(projectId, tool)];
  return typeof value === 'boolean' ? value : null;
}

export function writeSidebarCollapsedPreference(
  projectId: string,
  tool: SidebarToolContext,
  collapsed: boolean,
) {
  if (typeof window === 'undefined') return;

  const next = {
    ...resolvePreferenceMap(),
    [preferenceKey(projectId, tool)]: collapsed,
  };
  window.localStorage.setItem(SIDEBAR_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
}
