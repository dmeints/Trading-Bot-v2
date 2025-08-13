
export interface BudgetStatus {
  provider: string;
  used: number;
  limit: number;
  resetAt: Date;
  available: boolean;
}

export class Budgeter {
  getStatus(): BudgetStatus[] {
    return [
      {
        provider: 'binance',
        used: 100,
        limit: 1000,
        resetAt: new Date(Date.now() + 3600000),
        available: true
      }
    ];
  }
}

export const budgeter = new Budgeter();
