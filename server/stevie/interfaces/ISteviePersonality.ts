/**
 * Stevie Personality Interface
 * Contracts for safe experimentation with different personality configurations
 */

export interface PersonalityConfig {
  version: string;
  traits: Record<string, any>;
  learning: boolean;
  adaptation_rate: number;
}

export interface PersonalityResponse {
  message: string;
  tone: 'encouraging' | 'analytical' | 'cautious' | 'excited' | 'neutral';
  confidence: number;
  reasoning?: string;
  memoryContext?: string[];
  proactiveInsight?: string;
}

export interface UserContext {
  userId: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  riskTolerance?: 'low' | 'medium' | 'high';
  preferredTone?: string;
  recentTrades?: any[];
  portfolioValue?: number;
}

/**
 * Main interface that all Stevie personalities must implement
 */
export interface ISteviePersonality {
  // Core personality identification
  getName(): string;
  getVersion(): string;
  getTraits(): Record<string, number>;
  
  // Configuration management
  getConfig(): PersonalityConfig;
  updateConfig(config: Partial<PersonalityConfig>): Promise<void>;
  
  // Response generation
  generateResponse(
    userId: string, 
    message: string, 
    context?: any
  ): Promise<PersonalityResponse>;
  
  // Learning and adaptation
  recordInteraction(
    userId: string,
    userMessage: string,
    response: PersonalityResponse,
    feedback?: 'positive' | 'negative'
  ): Promise<void>;
  
  isLearning(): boolean;
  adaptToUser(userId: string, interactions: any[]): Promise<void>;
  
  // Lifecycle management
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}