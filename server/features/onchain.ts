/**
 * On-Chain Analysis Features
 * Advanced blockchain metrics and activity analysis
 */

export interface OnchainFeatures {
  bias: number; // -1 to 1, bearish to bullish on-chain sentiment
  gas_spike_flag: boolean; // Whether gas fees have spiked recently
  whale_activity_score: number; // 0-1, level of whale activity
  network_congestion: number; // 0-1, network congestion level
  active_addresses_change: number; // % change in active addresses
  transaction_volume_usd: number; // USD value of recent transactions
  hash_rate_change: number; // % change in hash rate (for PoW chains)
  staking_ratio: number; // % of supply staked (for PoS chains)
}

/**
 * Calculate comprehensive on-chain features
 */
export async function calculateOnchain(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<OnchainFeatures | null> {
  try {
    console.log(`[OnChain] Calculating metrics for ${symbol}`);
    
    // Extract base symbol and determine blockchain
    const baseSymbol = symbol.split('/')[0].toUpperCase();
    const blockchain = getBlockchainForSymbol(baseSymbol);
    
    if (!blockchain) {
      console.log(`[OnChain] No blockchain mapping for ${symbol}`);
      return null;
    }
    
    // Get on-chain data from multiple sources
    const onchainData = await aggregateOnchainData(blockchain, baseSymbol, startTime, endTime);
    
    if (!onchainData) {
      console.log(`[OnChain] No on-chain data available for ${symbol}`);
      return null;
    }
    
    // Calculate comprehensive metrics
    const bias = calculateOnchainBias(onchainData);
    const gas_spike_flag = detectGasSpike(onchainData);
    const whale_activity_score = calculateWhaleActivityScore(onchainData);
    const network_congestion = calculateNetworkCongestion(onchainData);
    const active_addresses_change = calculateActiveAddressesChange(onchainData);
    const transaction_volume_usd = onchainData.transactionVolumeUsd || 0;
    const hash_rate_change = calculateHashRateChange(onchainData);
    const staking_ratio = calculateStakingRatio(onchainData);
    
    const result: OnchainFeatures = {
      bias: Math.round(bias * 1000) / 1000,
      gas_spike_flag,
      whale_activity_score: Math.round(whale_activity_score * 1000) / 1000,
      network_congestion: Math.round(network_congestion * 1000) / 1000,
      active_addresses_change: Math.round(active_addresses_change * 100) / 100,
      transaction_volume_usd: Math.round(transaction_volume_usd),
      hash_rate_change: Math.round(hash_rate_change * 100) / 100,
      staking_ratio: Math.round(staking_ratio * 100) / 100
    };
    
    console.log(`[OnChain] Calculated for ${symbol}: bias=${result.bias}, whale_score=${result.whale_activity_score}, gas_spike=${result.gas_spike_flag}`);
    
    return result;
    
  } catch (error) {
    console.error(`[OnChain] Error calculating for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get blockchain network for symbol
 */
function getBlockchainForSymbol(symbol: string): string | null {
  const blockchainMap: { [key: string]: string } = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'MATIC': 'polygon',
    'AVAX': 'avalanche',
    'LINK': 'ethereum', // ERC-20 token
    'UNI': 'ethereum', // ERC-20 token
    'AAVE': 'ethereum' // ERC-20 token
  };
  
  return blockchainMap[symbol] || null;
}

/**
 * Aggregate on-chain data from multiple sources
 * In production, this would integrate with blockchain APIs
 */
async function aggregateOnchainData(blockchain: string, symbol: string, startTime: Date, endTime: Date): Promise<any> {
  // This is a placeholder for real on-chain data aggregation
  // In production, this would:
  // 1. Call blockchain APIs (Etherscan, Blockchair, etc.) with proper authentication
  // 2. Query blockchain nodes directly for real-time data
  // 3. Aggregate data from multiple blockchain analytics providers
  // 4. Calculate derived metrics from raw blockchain data
  
  const timeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  // Simulate realistic on-chain data patterns
  const baseValue = Date.now() / (1000 * 60 * 60 * 24); // Days since epoch
  const cycleFactor = Math.sin(baseValue / 7) * 0.3; // Weekly cycle
  const randomFactor = Math.random() * 0.4 - 0.2; // Random variation
  
  const mockData = {
    gasPrice: blockchain === 'ethereum' ? Math.max(10, 50 + cycleFactor * 200 + randomFactor * 50) : null,
    gasPriceHistory: Array.from({length: 24}, (_, i) => Math.max(10, 50 + Math.sin(i / 4) * 30)),
    
    activeAddresses: Math.max(10000, 500000 + cycleFactor * 200000 + randomFactor * 100000),
    activeAddressesHistory: Array.from({length: 7}, () => Math.max(10000, 500000 + Math.random() * 100000)),
    
    transactionCount: Math.max(1000, 50000 + cycleFactor * 20000 + randomFactor * 10000),
    transactionVolumeUsd: Math.max(1000000, 500000000 + cycleFactor * 200000000 + randomFactor * 100000000),
    
    whaleTransactions: Array.from({length: 10}, () => ({
      value: Math.random() * 10000000 + 1000000, // $1M-$10M transactions
      direction: Math.random() > 0.5 ? 'in' : 'out'
    })),
    
    hashRate: blockchain === 'bitcoin' ? Math.max(100, 200 + cycleFactor * 50 + randomFactor * 30) : null,
    hashRateHistory: blockchain === 'bitcoin' ? Array.from({length: 7}, () => Math.max(100, 200 + Math.random() * 50)) : null,
    
    stakingData: ['ethereum', 'cardano', 'solana', 'polkadot'].includes(blockchain) ? {
      totalStaked: Math.random() * 30 + 40, // 40-70% of supply
      stakingRewards: Math.random() * 5 + 3 // 3-8% APY
    } : null,
    
    blockchain,
    symbol,
    lastUpdated: new Date().toISOString()
  };
  
  console.log(`[OnChain] Aggregated data for ${blockchain}/${symbol}: Active addresses=${mockData.activeAddresses.toFixed(0)}, Tx volume=$${(mockData.transactionVolumeUsd/1000000).toFixed(1)}M`);
  
  return mockData;
}

/**
 * Calculate overall on-chain bias (bullish/bearish sentiment)
 */
function calculateOnchainBias(data: any): number {
  let bias = 0;
  
  // Active addresses trend
  if (data.activeAddressesHistory && data.activeAddressesHistory.length > 3) {
    const recent = data.activeAddressesHistory.slice(-3);
    const older = data.activeAddressesHistory.slice(0, 3);
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const addressesGrowth = (recentAvg - olderAvg) / olderAvg;
    bias += addressesGrowth * 2; // Weight: 2x
  }
  
  // Whale activity analysis
  if (data.whaleTransactions) {
    const inflows = data.whaleTransactions.filter((tx: any) => tx.direction === 'in');
    const outflows = data.whaleTransactions.filter((tx: any) => tx.direction === 'out');
    
    const inflowValue = inflows.reduce((sum, tx) => sum + tx.value, 0);
    const outflowValue = outflows.reduce((sum, tx) => sum + tx.value, 0);
    
    if (inflowValue + outflowValue > 0) {
      const netFlow = (inflowValue - outflowValue) / (inflowValue + outflowValue);
      bias += netFlow * 0.3; // Weight: 0.3x
    }
  }
  
  // Transaction volume trend (higher volume can be bullish)
  const volumeScore = Math.min(1, data.transactionVolumeUsd / 1000000000); // Normalize by $1B
  bias += (volumeScore - 0.5) * 0.2; // Weight: 0.2x
  
  // Hash rate trend (for PoW chains, increasing hash rate is bullish)
  if (data.hashRateHistory && data.hashRateHistory.length > 3) {
    const recent = data.hashRateHistory.slice(-2).reduce((sum, val) => sum + val, 0) / 2;
    const older = data.hashRateHistory.slice(0, 2).reduce((sum, val) => sum + val, 0) / 2;
    
    if (older > 0) {
      const hashRateGrowth = (recent - older) / older;
      bias += hashRateGrowth * 0.4; // Weight: 0.4x
    }
  }
  
  // Staking ratio trend (increasing staking can be bullish for PoS chains)
  if (data.stakingData) {
    const stakingRatio = data.stakingData.totalStaked / 100; // Convert % to ratio
    if (stakingRatio > 0.5) { // Above 50% staked is generally bullish
      bias += (stakingRatio - 0.5) * 0.3; // Weight: 0.3x
    }
  }
  
  // Normalize bias to [-1, 1] range
  return Math.max(-1, Math.min(1, bias));
}

/**
 * Detect gas price spikes (for Ethereum-based tokens)
 */
function detectGasSpike(data: any): boolean {
  if (!data.gasPrice || !data.gasPriceHistory) {
    return false;
  }
  
  const currentGas = data.gasPrice;
  const avgHistoricalGas = data.gasPriceHistory.reduce((sum: number, price: number) => sum + price, 0) / data.gasPriceHistory.length;
  
  // Spike if current gas is 2x or more than historical average
  const spikeThreshold = 2.0;
  return currentGas > avgHistoricalGas * spikeThreshold;
}

/**
 * Calculate whale activity score
 */
function calculateWhaleActivityScore(data: any): number {
  if (!data.whaleTransactions || data.whaleTransactions.length === 0) {
    return 0;
  }
  
  // Calculate total whale transaction value
  const totalWhaleValue = data.whaleTransactions.reduce((sum: number, tx: any) => sum + tx.value, 0);
  
  // Calculate frequency score (more transactions = higher activity)
  const frequencyScore = Math.min(1, data.whaleTransactions.length / 20); // Normalize by 20 transactions
  
  // Calculate volume score (higher values = more significant)
  const volumeScore = Math.min(1, totalWhaleValue / 100000000); // Normalize by $100M
  
  // Combined score
  return (frequencyScore * 0.4) + (volumeScore * 0.6);
}

/**
 * Calculate network congestion level
 */
function calculateNetworkCongestion(data: any): number {
  let congestion = 0;
  
  // Gas price indicator (for Ethereum-like networks)
  if (data.gasPrice && data.gasPriceHistory) {
    const avgGas = data.gasPriceHistory.reduce((sum: number, price: number) => sum + price, 0) / data.gasPriceHistory.length;
    const gasPressure = Math.min(2, data.gasPrice / avgGas); // Max 2x multiplier
    congestion += (gasPressure - 1) * 0.5; // Weight: 0.5x
  }
  
  // Transaction count relative to capacity
  if (data.transactionCount) {
    // Assume network capacity varies by blockchain
    const capacityMap: { [key: string]: number } = {
      'bitcoin': 7, // ~7 TPS
      'ethereum': 15, // ~15 TPS
      'solana': 3000, // ~3000 TPS
      'polygon': 7000, // ~7000 TPS
      'avalanche': 4500 // ~4500 TPS
    };
    
    const maxTps = capacityMap[data.blockchain] || 100;
    const currentTps = data.transactionCount / 3600; // Assuming hourly data
    const utilizationRatio = currentTps / maxTps;
    
    congestion += Math.min(1, utilizationRatio) * 0.5; // Weight: 0.5x
  }
  
  return Math.max(0, Math.min(1, congestion));
}

/**
 * Calculate change in active addresses
 */
function calculateActiveAddressesChange(data: any): number {
  if (!data.activeAddressesHistory || data.activeAddressesHistory.length < 2) {
    return 0;
  }
  
  const current = data.activeAddresses;
  const previous = data.activeAddressesHistory[data.activeAddressesHistory.length - 2];
  
  if (previous <= 0) return 0;
  
  return ((current - previous) / previous) * 100; // Percentage change
}

/**
 * Calculate hash rate change (for PoW blockchains)
 */
function calculateHashRateChange(data: any): number {
  if (!data.hashRateHistory || data.hashRateHistory.length < 2) {
    return 0;
  }
  
  const recent = data.hashRateHistory.slice(-2).reduce((sum: number, val: number) => sum + val, 0) / 2;
  const older = data.hashRateHistory.slice(0, 2).reduce((sum: number, val: number) => sum + val, 0) / 2;
  
  if (older <= 0) return 0;
  
  return ((recent - older) / older) * 100; // Percentage change
}

/**
 * Calculate staking ratio (for PoS blockchains)
 */
function calculateStakingRatio(data: any): number {
  if (!data.stakingData) {
    return 0;
  }
  
  return data.stakingData.totalStaked || 0; // Already a percentage
}

/**
 * Get detailed whale transaction analysis
 */
export async function analyzeWhaleActivity(
  symbol: string,
  hours: number = 24
): Promise<{
  totalInflows: number;
  totalOutflows: number;
  netFlow: number;
  largestTransaction: number;
  transactionCount: number;
  avgTransactionSize: number;
} | null> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
    
    const baseSymbol = symbol.split('/')[0].toUpperCase();
    const blockchain = getBlockchainForSymbol(baseSymbol);
    
    if (!blockchain) return null;
    
    const data = await aggregateOnchainData(blockchain, baseSymbol, startTime, endTime);
    
    if (!data?.whaleTransactions) return null;
    
    const inflows = data.whaleTransactions.filter((tx: any) => tx.direction === 'in');
    const outflows = data.whaleTransactions.filter((tx: any) => tx.direction === 'out');
    
    const totalInflows = inflows.reduce((sum: number, tx: any) => sum + tx.value, 0);
    const totalOutflows = outflows.reduce((sum: number, tx: any) => sum + tx.value, 0);
    const netFlow = totalInflows - totalOutflows;
    
    const allValues = data.whaleTransactions.map((tx: any) => tx.value);
    const largestTransaction = Math.max(...allValues);
    const avgTransactionSize = allValues.reduce((sum: number, val: number) => sum + val, 0) / allValues.length;
    
    return {
      totalInflows: Math.round(totalInflows),
      totalOutflows: Math.round(totalOutflows),
      netFlow: Math.round(netFlow),
      largestTransaction: Math.round(largestTransaction),
      transactionCount: data.whaleTransactions.length,
      avgTransactionSize: Math.round(avgTransactionSize)
    };
    
  } catch (error) {
    console.error(`[OnChain] Error analyzing whale activity for ${symbol}:`, error);
    return null;
  }
}