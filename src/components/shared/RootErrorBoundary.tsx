import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../lib/utils';
import { Button } from '../primitives';

type RootErrorBoundaryProps = {
  children: ReactNode;
};

type RootErrorBoundaryState = {
  error: Error | null;
  copied: boolean;
};

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  override state: RootErrorBoundaryState = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error, copied: false };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack });
  }

  copyDetails = async () => {
    const details = this.state.error?.stack ?? this.state.error?.message ?? 'Unknown error';
    await navigator.clipboard?.writeText(details);
    this.setState({ copied: true });
  };

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
        <div className="max-w-lg rounded-lg border border-danger-500/30 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-950">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            Reload the app to try again, or copy the error details for debugging.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button type="button" variant="secondary" onClick={() => void this.copyDetails()}>
              {this.state.copied ? 'Copied' : 'Copy error details'}
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
