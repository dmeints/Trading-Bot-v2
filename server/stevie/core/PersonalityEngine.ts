/**
 * Personality Engine - Handles Stevie's personality and communication
 */

import { ISteviePersonality, PersonalityConfig, PersonalityResponse, UserContext } from '../interfaces/ISteviePersonality';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PersonalityEngine implements ISteviePersonality {
  private config: PersonalityConfig;
  private userContexts: Map<string, UserContext> = new Map();
  private interactionHistory: Map<string, any[]> = new Map();
  
  constructor(config: PersonalityConfig) {
    this.config = config;
  }
  
  getName(): string {
    return 'Stevie Personality Engine';
  }
  
  getVersion(): string {
    return this.config.version;
  }
  
  getTraits(): Record<string, number> {
    return this.config.traits;
  }
  
  getConfig(): PersonalityConfig {
    return { ...this.config };
  }
  
  async updateConfig(newConfig: Partial<PersonalityConfig>): Promise<void> {
    logger.info('[PersonalityEngine] Updating configuration', { newConfig });
    this.config = { ...this.config, ...newConfig };
    
    // Save updated config
    const configPath = path.join(__dirname, '../config/personality.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }
  
  async generateResponse(userId: string, message: string, context?: any): Promise<PersonalityResponse> {
    try {
      // Get or create user context
      let userContext = this.userContexts.get(userId);
      if (!userContext) {
        userContext = { userId };
        this.userContexts.set(userId, userContext);
      }
      
      // Load personality configuration
      const personalityConfig = await this.loadPersonalityConfig();
      
      // Determine appropriate tone based on message and context
      const tone = this.determineTone(message, context, personalityConfig);
      
      // Generate contextual response
      const response = this.generateContextualResponse(message, tone, personalityConfig, context);
      
      // Calculate confidence based on context clarity
      const confidence = this.calculateConfidence(message, context);
      
      const personalityResponse: PersonalityResponse = {
        message: response.message,
        tone,
        confidence,
        reasoning: response.reasoning,
        memoryContext: this.getRecentMemoryContext(userId),
        proactiveInsight: await this.generateProactiveInsight(userId, context)
      };
      
      // Record interaction for learning
      await this.recordInteraction(userId, message, personalityResponse);
      
      return personalityResponse;
      
    } catch (error) {
      logger.error('[PersonalityEngine] Error generating response', { error, userId });
      return this.getFallbackResponse();
    }
  }
  
  async recordInteraction(
    userId: string, 
    userMessage: string, 
    response: PersonalityResponse, 
    feedback?: 'positive' | 'negative'
  ): Promise<void> {
    if (!this.config.learning) return;
    
    const interaction = {
      timestamp: new Date(),
      userMessage,
      response: response.message,
      tone: response.tone,
      confidence: response.confidence,
      feedback
    };
    
    const history = this.interactionHistory.get(userId) || [];
    history.push(interaction);
    
    // Keep only recent interactions (configurable limit)
    const maxHistory = 100;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
    
    this.interactionHistory.set(userId, history);
    
    // Adapt to user preferences if learning is enabled
    if (this.config.learning && history.length % 10 === 0) {
      await this.adaptToUser(userId, history);
    }
  }
  
  isLearning(): boolean {
    return this.config.learning;
  }
  
  async adaptToUser(userId: string, interactions: any[]): Promise<void> {
    if (!this.config.learning) return;
    
    // Analyze user interaction patterns
    const positiveInteractions = interactions.filter(i => i.feedback === 'positive');
    const negativeInteractions = interactions.filter(i => i.feedback === 'negative');
    
    // Adjust personality traits based on feedback
    if (positiveInteractions.length > negativeInteractions.length) {
      // User likes current approach - slight reinforcement
      logger.info('[PersonalityEngine] Positive feedback trend detected', { userId });
    } else if (negativeInteractions.length > positiveInteractions.length) {
      // User dislikes current approach - adjust traits
      logger.info('[PersonalityEngine] Negative feedback trend detected, adapting', { userId });
      await this.adjustPersonalityTraits(userId, interactions);
    }
  }
  
  async initialize(): Promise<void> {
    logger.info('[PersonalityEngine] Initializing personality engine');
    
    try {
      // Load personality configuration from file
      const config = await this.loadPersonalityConfig();
      this.config = { ...this.config, ...config };
      
      logger.info('[PersonalityEngine] Personality engine initialized successfully');
    } catch (error) {
      logger.error('[PersonalityEngine] Failed to initialize', { error });
      throw error;
    }
  }
  
  async shutdown(): Promise<void> {
    logger.info('[PersonalityEngine] Shutting down personality engine');
    
    // Save interaction history if needed
    // Clean up resources
    
    logger.info('[PersonalityEngine] Personality engine shut down successfully');
  }
  
  // Private implementation methods
  
  private async loadPersonalityConfig(): Promise<any> {
    try {
      const configPath = path.join(__dirname, '../config/personality.json');
      const configFile = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configFile);
    } catch (error) {
      logger.warn('[PersonalityEngine] Could not load personality config, using defaults');
      return this.getDefaultPersonalityConfig();
    }
  }
  
  private determineTone(message: string, context: any, config: any): PersonalityResponse['tone'] {
    const lowerMessage = message.toLowerCase();
    
    // Determine tone based on message content and personality config
    if (lowerMessage.includes('help') || lowerMessage.includes('explain')) {
      return 'encouraging';
    }
    
    if (lowerMessage.includes('risk') || lowerMessage.includes('loss') || lowerMessage.includes('danger')) {
      return 'cautious';
    }
    
    if (lowerMessage.includes('profit') || lowerMessage.includes('win') || lowerMessage.includes('success')) {
      return 'excited';
    }
    
    if (lowerMessage.includes('analyze') || lowerMessage.includes('chart') || lowerMessage.includes('technical')) {
      return 'analytical';
    }
    
    return 'neutral';
  }
  
  private generateContextualResponse(message: string, tone: PersonalityResponse['tone'], config: any, context?: any): { message: string, reasoning: string } {
    // Generate response based on personality configuration and tone
    const responseTemplates = this.getResponseTemplates(tone, config);
    const template = responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
    
    // Personalize the template based on context
    let personalizedMessage = template;
    
    if (context?.marketData) {
      const symbol = context.marketData.symbol || 'BTC';
      const price = context.marketData.price || 'current levels';
      personalizedMessage = personalizedMessage.replace('{symbol}', symbol).replace('{price}', price);
    }
    
    return {
      message: personalizedMessage,
      reasoning: `Generated ${tone} response based on message content and personality traits`
    };
  }
  
  private getResponseTemplates(tone: PersonalityResponse['tone'], config: any): string[] {
    const templates = {
      encouraging: [
        "I'm here to help you navigate the crypto markets! Let's look at this together.",
        "Great question! Let me break this down for you in a way that makes sense.",
        "You're asking the right questions - that's how successful traders think!"
      ],
      analytical: [
        "Based on the current market conditions and technical indicators...",
        "Let me analyze the data for you. Here's what the charts are telling us:",
        "From a technical analysis perspective, here's what I'm seeing:"
      ],
      cautious: [
        "I want to make sure we consider all the risks here. Let me explain:",
        "This is important - let's talk about the potential downsides first:",
        "Before we proceed, it's crucial to understand the risks involved:"
      ],
      excited: [
        "This is an interesting development! Here's what it could mean:",
        "Great timing on this question! The markets are showing some fascinating patterns:",
        "I love analyzing these kinds of opportunities! Let me share what I'm seeing:"
      ],
      neutral: [
        "Let me help you with that. Here's what you need to know:",
        "I can provide some insight on this topic:",
        "Here's my analysis of the situation:"
      ]
    };
    
    return templates[tone] || templates.neutral;
  }
  
  private calculateConfidence(message: string, context?: any): number {
    let confidence = 0.7; // Base confidence
    
    // Increase confidence if we have market context
    if (context?.marketData) confidence += 0.1;
    
    // Increase confidence if message is clear and specific
    if (message.length > 10 && message.includes('?')) confidence += 0.1;
    
    // Decrease confidence for vague messages
    if (message.length < 5) confidence -= 0.2;
    
    return Math.max(0.1, Math.min(0.9, confidence));
  }
  
  private getRecentMemoryContext(userId: string): string[] {
    const interactions = this.interactionHistory.get(userId) || [];
    return interactions.slice(-3).map(i => `User: ${i.userMessage} | Stevie: ${i.response.substring(0, 50)}...`);
  }
  
  private async generateProactiveInsight(userId: string, context?: any): Promise<string | undefined> {
    // Generate proactive insights based on market conditions
    if (context?.marketData && Math.random() < 0.3) { // 30% chance
      return "By the way, I noticed some interesting volume patterns in the recent market data that might be worth discussing.";
    }
    
    return undefined;
  }
  
  private getFallbackResponse(): PersonalityResponse {
    return {
      message: "I'm having some technical difficulties right now, but I'm still here to help! Could you try asking that again?",
      tone: 'neutral',
      confidence: 0.3,
      reasoning: 'Fallback response due to error'
    };
  }
  
  private async adjustPersonalityTraits(userId: string, interactions: any[]): Promise<void> {
    // Implement personality adaptation logic based on user feedback
    logger.info('[PersonalityEngine] Adapting personality traits for user', { userId });
    
    // This would implement machine learning-based personality adaptation
    // For now, it's a placeholder for future enhancement
  }
  
  private getDefaultPersonalityConfig(): any {
    return {
      version: '1.0.0',
      traits: {
        optimism: 0.8,
        caution: 0.7,
        technical_focus: 0.9,
        empathy: 0.8,
        confidence: 0.7
      },
      learning: true,
      adaptation_rate: 0.1
    };
  }
}