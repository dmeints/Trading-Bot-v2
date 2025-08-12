
/**
 * Pareto Front Evolution System
 * Evolves trading strategies along multiple objectives (return, risk, drawdown)
 */

import { logger } from '../utils/logger';

export interface StrategyObjectives {
  strategyId: string;
  returns: number;        // Annualized return
  sharpe: number;         // Risk-adjusted return
  maxDrawdown: number;    // Maximum drawdown (negative)
  winRate: number;        // Win percentage
  profitFactor: number;   // Profit factor
  calmar: number;         // Calmar ratio
  sortino: number;        // Sortino ratio
}

export interface ParetoStrategy extends StrategyObjectives {
  dominationCount: number;    // Number of strategies this dominates
  dominatedBy: string[];      // IDs of strategies that dominate this
  crowdingDistance: number;   // Crowding distance for diversity
  rank: number;               // Pareto rank (1 = non-dominated front)
  parameters: Record<string, number>;
}

export interface ParetoFront {
  rank: number;
  strategies: ParetoStrategy[];
  hypervolume: number;
  diversity: number;
}

export interface EvolutionConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  objectives: string[];
  convergenceThreshold: number;
}

export class ParetoEvolutionSystem {
  private population: ParetoStrategy[] = [];
  private paretoFronts: ParetoFront[] = [];
  private generation: number = 0;
  private config: EvolutionConfig;
  private evolutionHistory: Array<{generation: number; hypervolume: number; diversity: number}> = [];

  constructor(config: Partial<EvolutionConfig> = {}) {
    this.config = {
      populationSize: 50,
      maxGenerations: 100,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      eliteRatio: 0.2,
      objectives: ['returns', 'sharpe', 'maxDrawdown', 'winRate', 'profitFactor'],
      convergenceThreshold: 0.01,
      ...config
    };
  }

  /**
   * Add strategy to population for evolution
   */
  addStrategy(objectives: StrategyObjectives, parameters: Record<string, number>): void {
    const strategy: ParetoStrategy = {
      ...objectives,
      dominationCount: 0,
      dominatedBy: [],
      crowdingDistance: 0,
      rank: 0,
      parameters: { ...parameters }
    };

    this.population.push(strategy);

    // Maintain population size
    if (this.population.length > this.config.populationSize) {
      this.population = this.population.slice(-this.config.populationSize);
    }

    logger.debug('[ParetoEvolution] Added strategy', {
      strategyId: objectives.strategyId,
      populationSize: this.population.length
    });
  }

  /**
   * Evolve population for one generation
   */
  evolveGeneration(): ParetoFront[] {
    if (this.population.length < 2) {
      return [];
    }

    this.generation++;

    // Step 1: Fast non-dominated sorting
    this.fastNonDominatedSort();

    // Step 2: Calculate crowding distances
    this.calculateCrowdingDistances();

    // Step 3: Generate new population through selection, crossover, and mutation
    this.generateNewPopulation();

    // Step 4: Calculate metrics
    this.calculateEvolutionMetrics();

    logger.info('[ParetoEvolution] Completed generation', {
      generation: this.generation,
      frontCount: this.paretoFronts.length,
      bestFrontSize: this.paretoFronts.length > 0 ? this.paretoFronts[0].strategies.length : 0
    });

    return this.paretoFronts;
  }

  private fastNonDominatedSort(): void {
    // Reset domination information
    this.population.forEach(strategy => {
      strategy.dominationCount = 0;
      strategy.dominatedBy = [];
    });

    // Calculate domination relationships
    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        const strategyI = this.population[i];
        const strategyJ = this.population[j];
        
        const dominationResult = this.checkDomination(strategyI, strategyJ);
        
        if (dominationResult === 1) {
          // I dominates J
          strategyJ.dominationCount++;
          strategyI.dominatedBy.push(strategyJ.strategyId);
        } else if (dominationResult === -1) {
          // J dominates I
          strategyI.dominationCount++;
          strategyJ.dominatedBy.push(strategyI.strategyId);
        }
      }
    }

    // Build fronts
    this.paretoFronts = [];
    let currentFront: ParetoStrategy[] = [];
    let rank = 1;

    // First front: non-dominated strategies
    this.population.forEach(strategy => {
      if (strategy.dominationCount === 0) {
        strategy.rank = rank;
        currentFront.push(strategy);
      }
    });

    while (currentFront.length > 0) {
      this.paretoFronts.push({
        rank,
        strategies: [...currentFront],
        hypervolume: 0, // Will be calculated later
        diversity: 0
      });

      const nextFront: ParetoStrategy[] = [];
      
      // Find next front
      currentFront.forEach(dominatedStrategy => {
        this.population.forEach(strategy => {
          if (strategy.dominatedBy.includes(dominatedStrategy.strategyId)) {
            strategy.dominationCount--;
            if (strategy.dominationCount === 0) {
              strategy.rank = rank + 1;
              nextFront.push(strategy);
            }
          }
        });
      });

      currentFront = nextFront;
      rank++;
    }
  }

  private checkDomination(strategyA: ParetoStrategy, strategyB: ParetoStrategy): number {
    let aDominatesB = false;
    let bDominatesA = false;

    for (const objective of this.config.objectives) {
      const valueA = this.getObjectiveValue(strategyA, objective);
      const valueB = this.getObjectiveValue(strategyB, objective);
      const isMaximizing = this.isMaximizingObjective(objective);

      if (isMaximizing) {
        if (valueA > valueB) aDominatesB = true;
        if (valueB > valueA) bDominatesA = true;
      } else {
        if (valueA < valueB) aDominatesB = true;
        if (valueB < valueA) bDominatesA = true;
      }
    }

    if (aDominatesB && !bDominatesA) return 1;
    if (bDominatesA && !aDominatesB) return -1;
    return 0; // Non-dominated
  }

  private getObjectiveValue(strategy: ParetoStrategy, objective: string): number {
    switch (objective) {
      case 'returns': return strategy.returns;
      case 'sharpe': return strategy.sharpe;
      case 'maxDrawdown': return strategy.maxDrawdown;
      case 'winRate': return strategy.winRate;
      case 'profitFactor': return strategy.profitFactor;
      case 'calmar': return strategy.calmar;
      case 'sortino': return strategy.sortino;
      default: return 0;
    }
  }

  private isMaximizingObjective(objective: string): boolean {
    // maxDrawdown is minimizing (less negative is better), others are maximizing
    return objective !== 'maxDrawdown';
  }

  private calculateCrowdingDistances(): void {
    this.paretoFronts.forEach(front => {
      front.strategies.forEach(strategy => {
        strategy.crowdingDistance = 0;
      });

      // Calculate crowding distance for each objective
      this.config.objectives.forEach(objective => {
        // Sort by objective value
        front.strategies.sort((a, b) => {
          const valueA = this.getObjectiveValue(a, objective);
          const valueB = this.getObjectiveValue(b, objective);
          return valueA - valueB;
        });

        // Set boundary strategies to infinite distance
        if (front.strategies.length > 0) {
          front.strategies[0].crowdingDistance = Infinity;
          front.strategies[front.strategies.length - 1].crowdingDistance = Infinity;
        }

        // Calculate crowding distance for middle strategies
        for (let i = 1; i < front.strategies.length - 1; i++) {
          if (front.strategies[i].crowdingDistance !== Infinity) {
            const objRange = this.getObjectiveValue(front.strategies[front.strategies.length - 1], objective) -
                           this.getObjectiveValue(front.strategies[0], objective);
            
            if (objRange > 0) {
              const distance = (this.getObjectiveValue(front.strategies[i + 1], objective) -
                              this.getObjectiveValue(front.strategies[i - 1], objective)) / objRange;
              front.strategies[i].crowdingDistance += distance;
            }
          }
        }
      });
    });
  }

  private generateNewPopulation(): void {
    const newPopulation: ParetoStrategy[] = [];
    
    // Elitism: Keep best strategies from first front
    const eliteCount = Math.floor(this.config.populationSize * this.config.eliteRatio);
    if (this.paretoFronts.length > 0) {
      const firstFront = this.paretoFronts[0].strategies
        .sort((a, b) => b.crowdingDistance - a.crowdingDistance)
        .slice(0, eliteCount);
      newPopulation.push(...firstFront);
    }

    // Generate offspring through crossover and mutation
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.tournamentSelection();
      const parent2 = this.tournamentSelection();
      
      let offspring: ParetoStrategy;
      
      if (Math.random() < this.config.crossoverRate) {
        offspring = this.crossover(parent1, parent2);
      } else {
        offspring = { ...parent1 };
      }
      
      if (Math.random() < this.config.mutationRate) {
        offspring = this.mutate(offspring);
      }
      
      // Assign temporary objectives (would be evaluated in real system)
      offspring.strategyId = `gen${this.generation}_${newPopulation.length}`;
      
      newPopulation.push(offspring);
    }

    this.population = newPopulation.slice(0, this.config.populationSize);
  }

  private tournamentSelection(): ParetoStrategy {
    const tournamentSize = 3;
    const tournament: ParetoStrategy[] = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[randomIndex]);
    }
    
    // Select best from tournament (lowest rank, highest crowding distance)
    tournament.sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return b.crowdingDistance - a.crowdingDistance;
    });
    
    return tournament[0];
  }

  private crossover(parent1: ParetoStrategy, parent2: ParetoStrategy): ParetoStrategy {
    const offspring: ParetoStrategy = {
      ...parent1,
      strategyId: `crossover_${Date.now()}`,
      parameters: {}
    };

    // Blend crossover for parameters
    Object.keys(parent1.parameters).forEach(param => {
      const alpha = 0.5; // Blend factor
      const value1 = parent1.parameters[param];
      const value2 = parent2.parameters[param] || value1;
      
      offspring.parameters[param] = alpha * value1 + (1 - alpha) * value2;
    });

    return offspring;
  }

  private mutate(strategy: ParetoStrategy): ParetoStrategy {
    const mutated: ParetoStrategy = {
      ...strategy,
      strategyId: `mutated_${Date.now()}`,
      parameters: { ...strategy.parameters }
    };

    // Gaussian mutation
    Object.keys(mutated.parameters).forEach(param => {
      if (Math.random() < 0.1) { // 10% chance to mutate each parameter
        const noise = (Math.random() - 0.5) * 0.1; // ±5% mutation
        mutated.parameters[param] *= (1 + noise);
      }
    });

    return mutated;
  }

  private calculateEvolutionMetrics(): void {
    if (this.paretoFronts.length === 0) return;

    // Calculate hypervolume for first front
    const firstFront = this.paretoFronts[0];
    firstFront.hypervolume = this.calculateHypervolume(firstFront.strategies);
    
    // Calculate diversity
    firstFront.diversity = this.calculateDiversity(firstFront.strategies);

    this.evolutionHistory.push({
      generation: this.generation,
      hypervolume: firstFront.hypervolume,
      diversity: firstFront.diversity
    });

    // Update front metrics
    this.paretoFronts[0] = firstFront;
  }

  private calculateHypervolume(strategies: ParetoStrategy[]): number {
    // Simplified hypervolume calculation
    if (strategies.length === 0) return 0;

    // Use reference point (worst possible values)
    const referencePoint = {
      returns: -0.5,
      sharpe: -2,
      maxDrawdown: -1,
      winRate: 0,
      profitFactor: 0
    };

    let hypervolume = 0;
    
    strategies.forEach(strategy => {
      let volume = 1;
      this.config.objectives.forEach(objective => {
        const value = this.getObjectiveValue(strategy, objective);
        const refValue = (referencePoint as any)[objective] || 0;
        const diff = this.isMaximizingObjective(objective) ? 
          Math.max(0, value - refValue) : 
          Math.max(0, refValue - value);
        volume *= diff;
      });
      hypervolume += volume;
    });

    return hypervolume;
  }

  private calculateDiversity(strategies: ParetoStrategy[]): number {
    if (strategies.length < 2) return 0;

    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        let distance = 0;
        
        this.config.objectives.forEach(objective => {
          const valueI = this.getObjectiveValue(strategies[i], objective);
          const valueJ = this.getObjectiveValue(strategies[j], objective);
          distance += (valueI - valueJ) ** 2;
        });
        
        totalDistance += Math.sqrt(distance);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDistance / pairCount : 0;
  }

  /**
   * Get current Pareto fronts
   */
  getParetoFronts(): ParetoFront[] {
    return this.paretoFronts;
  }

  /**
   * Get best strategies from first front
   */
  getBestStrategies(count: number = 5): ParetoStrategy[] {
    if (this.paretoFronts.length === 0) return [];
    
    return this.paretoFronts[0].strategies
      .sort((a, b) => b.crowdingDistance - a.crowdingDistance)
      .slice(0, count);
  }

  /**
   * Get evolution statistics
   */
  getEvolutionStats(): {
    generation: number;
    populationSize: number;
    frontCount: number;
    hypervolume: number;
    diversity: number;
    convergence: number;
  } {
    const latest = this.evolutionHistory[this.evolutionHistory.length - 1];
    const convergence = this.calculateConvergence();
    
    return {
      generation: this.generation,
      populationSize: this.population.length,
      frontCount: this.paretoFronts.length,
      hypervolume: latest?.hypervolume || 0,
      diversity: latest?.diversity || 0,
      convergence
    };
  }

  private calculateConvergence(): number {
    if (this.evolutionHistory.length < 10) return 0;
    
    const recent = this.evolutionHistory.slice(-10);
    const hvVariation = Math.sqrt(
      recent.reduce((sum, entry) => {
        const mean = recent.reduce((s, e) => s + e.hypervolume, 0) / recent.length;
        return sum + (entry.hypervolume - mean) ** 2;
      }, 0) / recent.length
    );
    
    return Math.max(0, 1 - hvVariation);
  }

  /**
   * Reset evolution system
   */
  reset(): void {
    this.population = [];
    this.paretoFronts = [];
    this.generation = 0;
    this.evolutionHistory = [];
    
    logger.info('[ParetoEvolution] Reset evolution system');
  }
}
