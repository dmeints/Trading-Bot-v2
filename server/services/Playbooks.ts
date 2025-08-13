
export interface Playbook {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  lastExecuted?: Date;
}

export class Playbooks {
  getAll(): Playbook[] {
    return [
      {
        id: 'high_vol',
        name: 'High Volatility Response',
        trigger: 'vol > 0.05',
        actions: ['reduce_position_size', 'increase_stops']
      }
    ];
  }
}

export const playbooks = new Playbooks();
