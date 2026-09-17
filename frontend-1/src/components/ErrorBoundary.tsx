import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-bg-base p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-lg font-semibold text-text-primary">Something went wrong</h1>
            <p className="text-sm text-text-secondary">
              The application encountered an unexpected error. Refresh the page to try again.
            </p>
            {this.state.message && (
              <p className="text-xs text-text-muted font-mono break-all">{this.state.message}</p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
