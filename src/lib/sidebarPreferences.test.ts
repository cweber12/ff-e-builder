import { beforeEach, describe, expect, it } from 'vitest';
import {
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from './sidebarPreferences';

const STORAGE_KEY = 'ffe-builder:project-tab-sidebar';

describe('sidebarPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no saved preference exists', () => {
    expect(readSidebarCollapsedPreference('project-1', 'ffe')).toBeNull();
  });

  it('reads and writes preferences per project and tool context', () => {
    writeSidebarCollapsedPreference('project-1', 'ffe', true);
    writeSidebarCollapsedPreference('project-1', 'proposal', false);
    writeSidebarCollapsedPreference('project-2', 'ffe', false);

    expect(readSidebarCollapsedPreference('project-1', 'ffe')).toBe(true);
    expect(readSidebarCollapsedPreference('project-1', 'proposal')).toBe(false);
    expect(readSidebarCollapsedPreference('project-2', 'ffe')).toBe(false);
    expect(readSidebarCollapsedPreference('project-2', 'plans')).toBeNull();
  });

  it('ignores malformed storage payloads and recovers on write', () => {
    window.localStorage.setItem(STORAGE_KEY, '{bad json');
    expect(readSidebarCollapsedPreference('project-1', 'ffe')).toBeNull();

    writeSidebarCollapsedPreference('project-1', 'ffe', true);
    expect(readSidebarCollapsedPreference('project-1', 'ffe')).toBe(true);
  });

  it('ignores non-boolean payload entries', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'project-1:ffe': 'true',
        'project-1:proposal': false,
      }),
    );

    expect(readSidebarCollapsedPreference('project-1', 'ffe')).toBeNull();
    expect(readSidebarCollapsedPreference('project-1', 'proposal')).toBe(false);
  });
});
