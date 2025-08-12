import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  retryCount: number;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout?: NodeJS.Timeout;
  private errorQueue: Array<{ error: Error; timestamp: number }> = [];

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0, 
      isRecovering: false 
    };

    // Enhanced unhandled promise rejection handling
    window.addEventListener('unhandledrejection', (event) => {
      const error = new Error(`Unhandled Promise Rejection: ${event.reason}`);
      this.handleUnhandledError(error, 'unhandled-promise');
      event.preventDefault();
    });

    // Global error handler for JavaScript errors
    window.addEventListener('error', (event) => {
      const error = new Error(`Global Error: ${event.message}`);
      error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
      this.handleUnhandledError(error, 'global-error');
    });

    // Network error monitoring
    window.addEventListener('online', () => {
      if (this.state.hasError) {
        this.handleNetworkRecovery();
      }
    });
  }

  private handleUnhandledError = (error: Error, source: string) => {
    // Rate limit error reporting (max 5 errors per minute)
    const now = Date.now();
    this.errorQueue = this.errorQueue.filter(e => now - e.timestamp < 60000);
    
    if (this.errorQueue.length >= 5) {
      console.warn('Error rate limit exceeded, suppressing further errors');
      return;
    }

    this.errorQueue.push({ error, timestamp: now });
    this.logError(error, { source });
  };

  private handleNetworkRecovery = () => {
    if (this.state.hasError && this.state.retryCount < this.maxRetries) {
      this.setState({ isRecovering: true });
      setTimeout(() => {
        this.retryFromError();
      }, 2000);
    }
  };

  private retryFromError = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorId: undefined,
      retryCount: prevState.retryCount + 1,
      isRecovering: false
    }));
  };

  private resetRetryCount = () => {
    this.setState({ retryCount: 0 });
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error, 
      errorId,
      isRecovering: false
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.logError(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private logError = async (error: Error, errorInfo?: ErrorInfo | { source?: string }) => {
    console.error('Error caught by boundary:', error, errorInfo);

    // Enhanced error details
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      name: error.name,
      componentStack: errorInfo && 'componentStack' in errorInfo ? errorInfo.componentStack : undefined,
      source: errorInfo && 'source' in errorInfo ? errorInfo.source : 'component',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      memory: (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : undefined,
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink
      } : undefined,
      retryCount: this.state.retryCount,
      sessionId: sessionStorage.getItem('sessionId') || 'unknown'
    };

    console.error('Detailed error info:', errorDetails);

    // Enhanced analytics logging
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          error_id: errorDetails.errorId,
          retry_count: errorDetails.retryCount
        }
      });
    }

    // Robust server logging with retry mechanism
    await this.sendErrorToServer(errorDetails, 3);
  };

  private sendErrorToServer = async (errorDetails: any, retries: number = 0): Promise<void> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorDetails),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

    } catch (err) {
      console.error('Failed to log error to server:', err);
      
      // Retry mechanism with exponential backoff
      if (retries > 0) {
        const delay = Math.pow(2, 4 - retries) * 1000; // 2s, 4s, 8s delays
        setTimeout(() => {
          this.sendErrorToServer(errorDetails, retries - 1);
        }, delay);
      } else {
        // Store in localStorage as last resort
        try {
          const storedErrors = JSON.parse(localStorage.getItem('failedErrors') || '[]');
          storedErrors.push(errorDetails);
          // Keep only last 10 errors
          localStorage.setItem('failedErrors', JSON.stringify(storedErrors.slice(-10)));
        } catch (storageErr) {
          console.error('Failed to store error in localStorage:', storageErr);
        }
      }
    }
  };

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Reset retry count after successful recovery
    if (prevState.hasError && !this.state.hasError && this.state.retryCount > 0) {
      setTimeout(() => {
        this.resetRetryCount();
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.retryFromError);
      }

      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-gray-400 mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              
              {this.state.errorId && (
                <p className="text-xs text-gray-500 mb-4 font-mono">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {this.props.enableRetry !== false && this.state.retryCount < this.maxRetries && (
                <button
                  onClick={this.retryFromError}
                  disabled={this.state.isRecovering}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  data-testid="retry-button"
                >
                  {this.state.isRecovering ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Recovering...
                    </>
                  ) : (
                    `Try Again ${this.state.retryCount > 0 ? `(${this.state.retryCount}/${this.maxRetries})` : ''}`
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined, errorId: undefined, retryCount: 0 });
                  window.location.reload();
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                data-testid="reload-button"
              >
                Reload Application
              </button>

              <button
                onClick={() => {
                  window.history.back();
                }}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                data-testid="back-button"
              >
                Go Back
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
              <details className="text-left">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                  Technical Details
                </summary>
                <div className="mt-2 text-xs text-gray-500 bg-gray-800 p-3 rounded font-mono overflow-auto max-h-32">
                  <div>Error: {this.state.error?.name}</div>
                  <div>Message: {this.state.error?.message}</div>
                  <div>Stack: {this.state.error?.stack?.slice(0, 200)}...</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}