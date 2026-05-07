import type { ImageEntityType } from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  toolState: (id: string) => ['projects', 'tool-state', id] as const,
};

export const planKeys = {
  forProject: (projectId: string) => ['plans', projectId] as const,
  calibration: (projectId: string, planId: string) =>
    ['plans', projectId, planId, 'calibration'] as const,
};

export const userProfileKeys = {
  me: ['user-profile', 'me'] as const,
};

export const roomKeys = {
  forProject: (projectId: string) => ['rooms', projectId] as const,
};

export const itemKeys = {
  all: ['items'] as const,
  forRoom: (roomId: string) => ['items', roomId] as const,
};

export const imageKeys = {
  all: ['images'] as const,
  forEntity: (entityType: ImageEntityType, entityId: string) =>
    ['images', entityType, entityId] as const,
};

export const materialKeys = {
  forProject: (projectId: string) => ['materials', projectId] as const,
};

export const proposalKeys = {
  categories: (projectId: string) => ['proposal', projectId, 'categories'] as const,
  items: (categoryId: string) => ['proposal', 'category', categoryId, 'items'] as const,
};
