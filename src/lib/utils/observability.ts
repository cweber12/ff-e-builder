export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error('[reportError]', error, context);
  }
}

const TELEMETRY_KEY = 'ffe-builder:telemetry';

type LocalTelemetry = {
  sessionCount: number;
  itemsCreated: number;
};

export function recordSession() {
  updateTelemetry((current) => ({ ...current, sessionCount: current.sessionCount + 1 }));
}

export function recordItemCreated() {
  updateTelemetry((current) => ({ ...current, itemsCreated: current.itemsCreated + 1 }));
}

export function readTelemetry(): LocalTelemetry {
  if (typeof window === 'undefined') return { sessionCount: 0, itemsCreated: 0 };

  const raw = window.localStorage.getItem(TELEMETRY_KEY);
  if (!raw) return { sessionCount: 0, itemsCreated: 0 };

  try {
    return { sessionCount: 0, itemsCreated: 0, ...JSON.parse(raw) } as LocalTelemetry;
  } catch {
    return { sessionCount: 0, itemsCreated: 0 };
  }
}

function updateTelemetry(updater: (current: LocalTelemetry) => LocalTelemetry) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(updater(readTelemetry())));
}
