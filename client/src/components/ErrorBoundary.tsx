import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || 'Something went wrong' };
  }

  componentDidCatch(error: any, info: any) {
    // Hook: send to server if desired
    console.error('ReactErrorBoundary', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
          <button onClick={() => this.setState({ hasError: false, message: undefined })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
