
export interface Incident {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: Date;
}

export class IncidentManager {
  getActive(): Incident[] {
    return [];
  }

  create(severity: Incident['severity'], description: string): Incident {
    return {
      id: `inc_${Date.now()}`,
      severity,
      description,
      status: 'open',
      createdAt: new Date()
    };
  }
}

export const incidentManager = new IncidentManager();
