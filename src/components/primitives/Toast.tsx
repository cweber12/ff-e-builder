import type { ComponentProps } from 'react';
import { Toaster } from 'sonner';

/**
 * Toast provider wrapper so callers do not import sonner directly.
 */
export function ToastProvider(props: ComponentProps<typeof Toaster>) {
  return <Toaster {...props} />;
}
