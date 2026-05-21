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
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-lg border-y border-danger-500/40 bg-canvas-chrome px-10 py-12 text-center shadow-sm">
          <p className="num text-[11px] font-semibold uppercase tracking-[0.18em] text-danger-600">
            Error
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-neutral-950">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
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
