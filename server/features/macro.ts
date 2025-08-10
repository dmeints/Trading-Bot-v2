/**
 * Macro Economic Features
 * Analysis of macroeconomic events and their impact on crypto markets
 */

export interface MacroFeatures {
  blackout: boolean; // Whether we're in a macro event blackout period
  risk_on_sentiment: number; // -1 to 1, risk-off to risk-on sentiment
  recent_impact_score: number; // 0-1, impact of recent macro events
  fed_policy_stance: 'dovish' | 'neutral' | 'hawkish';
  inflation_pressure: number; // 0-1, current inflation pressure
  global_growth_outlook: number; // -1 to 1, bearish to bullish growth outlook
  usd_strength_index: number; // 0-100, relative USD strength
  vix_level: number; // Volatility index level
}

/**
 * Calculate comprehensive macro economic features
 */
export async function calculateMacro(
  startTime: Date,
  endTime: Date
): Promise<MacroFeatures | null> {
  try {
    console.log(`[Macro] Calculating macroeconomic features`);
    
    // Get macro data from multiple sources
    const macroData = await aggregateMacroData(startTime, endTime);
    
    if (!macroData) {
      console.log(`[Macro] No macro data available`);
      return null;
    }
    
    // Calculate comprehensive metrics
    const blackout = detectBlackoutPeriod(macroData);
    const risk_on_sentiment = calculateRiskSentiment(macroData);
    const recent_impact_score = calculateRecentImpactScore(macroData);
    const fed_policy_stance = analyzeFedPolicyStance(macroData);
    const inflation_pressure = calculateInflationPressure(macroData);
    const global_growth_outlook = calculateGrowthOutlook(macroData);
    const usd_strength_index = calculateUSDStrength(macroData);
    const vix_level = macroData.vixLevel || 20;
    
    const result: MacroFeatures = {
      blackout,
      risk_on_sentiment: Math.round(risk_on_sentiment * 1000) / 1000,
      recent_impact_score: Math.round(recent_impact_score * 1000) / 1000,
      fed_policy_stance,
      inflation_pressure: Math.round(inflation_pressure * 1000) / 1000,
      global_growth_outlook: Math.round(global_growth_outlook * 1000) / 1000,
      usd_strength_index: Math.round(usd_strength_index * 100) / 100,
      vix_level: Math.round(vix_level * 100) / 100
    };
    
    console.log(`[Macro] Calculated features: blackout=${result.blackout}, risk_on=${result.risk_on_sentiment}, fed_stance=${result.fed_policy_stance}`);
    
    return result;
    
  } catch (error) {
    console.error(`[Macro] Error calculating macro features:`, error);
    return null;
  }
}

/**
 * Aggregate macro economic data from multiple sources
 * In production, this would integrate with economic data providers
 */
async function aggregateMacroData(startTime: Date, endTime: Date): Promise<any> {
  // This is a placeholder for real macro data aggregation
  // In production, this would:
  // 1. Call economic data APIs (FRED, Trading Economics, Bloomberg, etc.)
  // 2. Fetch central bank communications and policy updates
  // 3. Monitor economic calendar for upcoming events
  // 4. Track market indicators (VIX, DXY, bond yields, etc.)
  // 5. Analyze geopolitical events and their market impact
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hourOfDay = now.getHours();
  const dayOfMonth = now.getDate();
  
  // Simulate realistic macro data patterns
  const baseValue = now.getTime() / (1000 * 60 * 60 * 24); // Days since epoch
  const monthlyCycle = Math.sin(baseValue / 30) * 0.3; // Monthly cycle
  const weeklyPattern = Math.cos(baseValue / 7) * 0.2; // Weekly pattern
  
  const mockData = {
    // Economic calendar events
    upcomingEvents: generateUpcomingEvents(),
    recentEvents: generateRecentEvents(),
    
    // Market indicators
    vixLevel: Math.max(12, 20 + monthlyCycle * 15 + Math.random() * 8),
    dxyIndex: Math.max(80, 100 + monthlyCycle * 10 + Math.random() * 5),
    us10yYield: Math.max(3, 4.5 + monthlyCycle * 0.8 + Math.random() * 0.4),
    
    // Fed policy indicators
    fedFundsRate: 5.25, // Current fed funds rate
    fedSpeechesToday: dayOfWeek >= 1 && dayOfWeek <= 5 ? Math.floor(Math.random() * 3) : 0,
    fomc_meeting_this_week: isCurrentWeekFOMC(),
    
    // Economic data
    cpiLastMonth: 3.2 + Math.random() * 0.8, // Inflation rate
    unemploymentRate: 3.8 + Math.random() * 0.4,
    gdpGrowthRate: 2.1 + Math.random() * 0.6,
    
    // Global factors
    geopoliticalTension: Math.random() * 0.7 + 0.1,
    oilPrice: 75 + monthlyCycle * 15 + Math.random() * 10,
    goldPrice: 2000 + monthlyCycle * 200 + Math.random() * 50,
    
    // Market sentiment indicators
    equityMarketTrend: monthlyCycle + Math.random() * 0.4 - 0.2,
    bondMarketSignal: weeklyPattern + Math.random() * 0.3 - 0.15,
    commodityTrend: monthlyCycle * 0.8 + Math.random() * 0.5 - 0.25,
    
    lastUpdated: now.toISOString()
  };
  
  console.log(`[Macro] Aggregated macro data: VIX=${mockData.vixLevel.toFixed(1)}, DXY=${mockData.dxyIndex.toFixed(1)}, Fed events=${mockData.fedSpeechesToday}`);
  
  return mockData;
}

/**
 * Detect if we're in a macro event blackout period
 */
function detectBlackoutPeriod(data: any): boolean {
  // FOMC meeting week
  if (data.fomc_meeting_this_week) {
    return true;
  }
  
  // Major economic releases today
  const majorEventsToday = data.upcomingEvents?.filter((event: any) => 
    event.importance === 'high' && isEventToday(event.date)
  );
  
  if (majorEventsToday && majorEventsToday.length > 0) {
    return true;
  }
  
  // High geopolitical tension
  if (data.geopoliticalTension > 0.7) {
    return true;
  }
  
  // Extreme market volatility
  if (data.vixLevel > 30) {
    return true;
  }
  
  return false;
}

/**
 * Calculate risk-on/risk-off sentiment
 */
function calculateRiskSentiment(data: any): number {
  let sentiment = 0;
  
  // VIX level (lower VIX = more risk-on)
  const vixScore = Math.max(0, Math.min(1, (40 - data.vixLevel) / 25)); // Normalize 15-40 to 0-1
  sentiment += (vixScore - 0.5) * 0.4; // Weight: 0.4x
  
  // Equity market trend
  sentiment += data.equityMarketTrend * 0.3; // Weight: 0.3x
  
  // USD strength (weaker USD can be risk-on for crypto)
  const usdStrengthNormalized = (data.dxyIndex - 90) / 20; // Normalize around 90-110
  sentiment -= usdStrengthNormalized * 0.2; // Weight: -0.2x (inverse)
  
  // Bond yields (higher yields can indicate growth optimism)
  const yieldScore = (data.us10yYield - 4) / 2; // Normalize around 4%
  sentiment += yieldScore * 0.1; // Weight: 0.1x
  
  return Math.max(-1, Math.min(1, sentiment));
}

/**
 * Calculate recent macro impact score
 */
function calculateRecentImpactScore(data: any): number {
  let impact = 0;
  
  // Recent high-impact events
  if (data.recentEvents) {
    const highImpactEvents = data.recentEvents.filter((event: any) => event.importance === 'high');
    impact += highImpactEvents.length * 0.2; // Weight: 0.2x per event
  }
  
  // Fed speeches/communications
  impact += data.fedSpeechesToday * 0.15; // Weight: 0.15x per speech
  
  // Market volatility
  if (data.vixLevel > 25) {
    impact += (data.vixLevel - 25) / 25 * 0.3; // Weight: 0.3x for elevated VIX
  }
  
  // Geopolitical events
  impact += data.geopoliticalTension * 0.2; // Weight: 0.2x
  
  return Math.max(0, Math.min(1, impact));
}

/**
 * Analyze Fed policy stance
 */
function analyzeFedPolicyStance(data: any): 'dovish' | 'neutral' | 'hawkish' {
  // Simplified Fed stance analysis
  const inflationTarget = 2.0;
  const currentInflation = data.cpiLastMonth;
  const currentUnemployment = data.unemploymentRate;
  const targetUnemployment = 4.0;
  
  // Hawkish if inflation well above target
  if (currentInflation > inflationTarget + 1.5) {
    return 'hawkish';
  }
  
  // Dovish if unemployment well above target or inflation well below target
  if (currentUnemployment > targetUnemployment + 1.0 || currentInflation < inflationTarget - 0.5) {
    return 'dovish';
  }
  
  // Otherwise neutral
  return 'neutral';
}

/**
 * Calculate inflation pressure
 */
function calculateInflationPressure(data: any): number {
  const inflationTarget = 2.0;
  const currentInflation = data.cpiLastMonth;
  
  // Normalize inflation pressure
  const pressure = Math.max(0, currentInflation - inflationTarget) / 4; // Max pressure at 6% inflation
  
  // Adjust for oil prices (proxy for energy inflation)
  const oilPressure = Math.max(0, data.oilPrice - 70) / 100; // Additional pressure above $70
  
  return Math.max(0, Math.min(1, pressure + oilPressure * 0.3));
}

/**
 * Calculate global growth outlook
 */
function calculateGrowthOutlook(data: any): number {
  let outlook = 0;
  
  // GDP growth rate
  const gdpScore = (data.gdpGrowthRate - 2) / 3; // Normalize around 2% target
  outlook += gdpScore * 0.4; // Weight: 0.4x
  
  // Unemployment rate (lower is better)
  const unemploymentScore = (5 - data.unemploymentRate) / 2; // Normalize around 4%
  outlook += unemploymentScore * 0.3; // Weight: 0.3x
  
  // Equity market trend
  outlook += data.equityMarketTrend * 0.2; // Weight: 0.2x
  
  // Commodity trend (can indicate economic activity)
  outlook += data.commodityTrend * 0.1; // Weight: 0.1x
  
  return Math.max(-1, Math.min(1, outlook));
}

/**
 * Calculate USD strength index
 */
function calculateUSDStrength(data: any): number {
  // Use DXY as primary measure
  const dxyNormalized = Math.max(0, Math.min(100, data.dxyIndex - 80)); // Normalize 80-120 to 0-40
  
  // Adjust for yield differentials
  const yieldBonus = Math.max(0, data.us10yYield - 3) * 5; // Higher yields strengthen USD
  
  return Math.max(0, Math.min(100, dxyNormalized + yieldBonus));
}

// Helper functions

function generateUpcomingEvents(): any[] {
  const events = [
    { name: 'CPI Release', date: getNextEventDate(14), importance: 'high' },
    { name: 'Employment Report', date: getNextEventDate(7), importance: 'high' },
    { name: 'Fed Speech', date: getNextEventDate(3), importance: 'medium' },
    { name: 'GDP Preliminary', date: getNextEventDate(21), importance: 'medium' },
    { name: 'Retail Sales', date: getNextEventDate(10), importance: 'medium' }
  ];
  
  return events.filter(event => new Date(event.date) > new Date());
}

function generateRecentEvents(): any[] {
  const events = [
    { name: 'Fed Minutes Release', date: getPastEventDate(2), importance: 'high', impact: 'neutral' },
    { name: 'PCE Price Index', date: getPastEventDate(5), importance: 'medium', impact: 'slightly_hawkish' },
    { name: 'Jobless Claims', date: getPastEventDate(1), importance: 'low', impact: 'neutral' }
  ];
  
  return events.filter(event => new Date(event.date) < new Date());
}

function getNextEventDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

function getPastEventDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function isEventToday(eventDate: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return eventDate === today;
}

function isCurrentWeekFOMC(): boolean {
  // Simplified: FOMC meets roughly 8 times per year
  // This would check actual FOMC calendar in production
  const now = new Date();
  const weekOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // FOMC typically meets every 6-7 weeks
  const fomcWeeks = [6, 13, 20, 27, 34, 41, 48];
  return fomcWeeks.some(week => Math.abs(weekOfYear - week) <= 1);
}

/**
 * Get economic calendar for the next N days
 */
export async function getEconomicCalendar(days: number = 7): Promise<any[]> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Yesterday
    
    const data = await aggregateMacroData(startTime, endTime);
    
    return data?.upcomingEvents || [];
  } catch (error) {
    console.error('[Macro] Error getting economic calendar:', error);
    return [];
  }
}

/**
 * Analyze Fed communication sentiment
 */
export async function analyzeFedCommunications(): Promise<{
  stance: 'dovish' | 'neutral' | 'hawkish';
  confidence: number;
  recent_speeches: number;
  key_themes: string[];
} | null> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last week
    
    const data = await aggregateMacroData(startTime, endTime);
    
    if (!data) return null;
    
    const stance = analyzeFedPolicyStance(data);
    
    return {
      stance,
      confidence: 0.7 + Math.random() * 0.25, // Simulate confidence score
      recent_speeches: data.fedSpeechesToday + Math.floor(Math.random() * 3),
      key_themes: ['inflation outlook', 'labor market', 'monetary policy path', 'financial stability']
    };
  } catch (error) {
    console.error('[Macro] Error analyzing Fed communications:', error);
    return null;
  }
}