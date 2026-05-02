export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error('[reportError]', error, context);
  }
}
