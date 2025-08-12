
export interface RecoveryStrategy {
  name: string;
  canRecover: (error: Error, context?: any) => boolean;
  recover: (error: Error, context?: any) => Promise<boolean>;
  priority: number;
}

export class ErrorRecoveryService {
  private strategies: RecoveryStrategy[] = [];
  private recoveryAttempts = new Map<string, number>();
  private maxAttempts = 3;

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies() {
    // Network error recovery
    this.addStrategy({
      name: 'network-retry',
      priority: 1,
      canRecover: (error) => {
        return error.message.includes('NetworkError') || 
               error.message.includes('Failed to fetch') ||
               error.message.includes('ERR_NETWORK');
      },
      recover: async (error, context) => {
        // Wait for network to come back online
        if (!navigator.onLine) {
          await this.waitForOnline();
        }
        
        // Retry the failed request if context provided
        if (context && context.retryFunction) {
          try {
            await context.retryFunction();
            return true;
          } catch (retryError) {
            return false;
          }
        }
        
        return navigator.onLine;
      }
    });

    // Memory pressure recovery
    this.addStrategy({
      name: 'memory-cleanup',
      priority: 2,
      canRecover: (error) => {
        return error.message.includes('out of memory') ||
               error.message.includes('Maximum call stack');
      },
      recover: async () => {
        // Force garbage collection if available
        if ((window as any).gc) {
          (window as any).gc();
        }
        
        // Clear caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }
        
        // Clear localStorage non-essential items
        this.clearNonEssentialStorage();
        
        return true;
      }
    });

    // Session recovery
    this.addStrategy({
      name: 'session-refresh',
      priority: 3,
      canRecover: (error) => {
        return error.message.includes('Unauthorized') ||
               error.message.includes('401') ||
               error.message.includes('session');
      },
      recover: async () => {
        try {
          // Attempt to refresh session
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          });
          
          return response.ok;
        } catch {
          return false;
        }
      }
    });

    // Component state recovery
    this.addStrategy({
      name: 'state-reset',
      priority: 4,
      canRecover: (error) => {
        return error.message.includes('state') ||
               error.message.includes('Cannot read prop');
      },
      recover: async (error, context) => {
        if (context && context.resetState) {
          context.resetState();
          return true;
        }
        return false;
      }
    });
  }

  addStrategy(strategy: RecoveryStrategy) {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  async attemptRecovery(error: Error, context?: any): Promise<boolean> {
    const errorKey = this.getErrorKey(error);
    const attempts = this.recoveryAttempts.get(errorKey) || 0;

    if (attempts >= this.maxAttempts) {
      console.warn(`Max recovery attempts reached for error: ${errorKey}`);
      return false;
    }

    this.recoveryAttempts.set(errorKey, attempts + 1);

    // Find applicable strategies
    const applicableStrategies = this.strategies.filter(s => s.canRecover(error, context));

    for (const strategy of applicableStrategies) {
      try {
        console.log(`Attempting recovery with strategy: ${strategy.name}`);
        const recovered = await strategy.recover(error, context);
        
        if (recovered) {
          console.log(`Successfully recovered using strategy: ${strategy.name}`);
          this.recoveryAttempts.delete(errorKey);
          return true;
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy ${strategy.name} failed:`, recoveryError);
      }
    }

    return false;
  }

  private getErrorKey(error: Error): string {
    return `${error.name}_${error.message.slice(0, 50)}`;
  }

  private waitForOnline(): Promise<void> {
    return new Promise((resolve) => {
      if (navigator.onLine) {
        resolve();
        return;
      }

      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };

      window.addEventListener('online', handleOnline);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('online', handleOnline);
        resolve();
      }, 30000);
    });
  }

  private clearNonEssentialStorage() {
    const essentialKeys = ['sessionId', 'authToken', 'userPreferences'];
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !essentialKeys.some(essential => key.includes(essential))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  resetAttempts(error?: Error) {
    if (error) {
      const errorKey = this.getErrorKey(error);
      this.recoveryAttempts.delete(errorKey);
    } else {
      this.recoveryAttempts.clear();
    }
  }

  getRecoveryStats() {
    return {
      activeAttempts: this.recoveryAttempts.size,
      strategies: this.strategies.length,
      maxAttempts: this.maxAttempts
    };
  }
}

export const errorRecoveryService = new ErrorRecoveryService();
