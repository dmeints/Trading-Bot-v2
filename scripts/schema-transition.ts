#!/usr/bin/env tsx

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as optimizedSchema from '../shared/optimized-schema';

/**
 * Data migration script to transition from 15+ table legacy schema 
 * to the new optimized 8-10 table design
 */

async function migrateToOptimizedSchema() {
  console.log('🔄 Starting schema transition to optimized design...');
  
  try {
    // 1. Create optimized tables (will use drizzle-kit push)
    console.log('📋 Creating optimized table structure...');
    
    // 2. Migrate existing data if legacy tables exist
    const legacyCheck = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('trading_signals', 'market_regimes', 'sentiment_data', 'agent_memories', 'trading_strategies')
    `);
    
    if (legacyCheck.rows.length > 0) {
      console.log(`📦 Found ${legacyCheck.rows.length} legacy tables to migrate`);
      
      // Migrate trading signals → market events
      await db.execute(sql`
        INSERT INTO "marketEvents" (event_type, symbol, timestamp, data, confidence, impact, source)
        SELECT 
          'trading_signal' as event_type,
          symbol,
          created_at as timestamp,
          json_build_object(
            'signal_type', signal_type,
            'strength', strength,
            'price', price,
            'indicators', indicators
          ) as data,
          confidence,
          CASE 
            WHEN strength > 0.7 THEN 'high'
            WHEN strength > 0.4 THEN 'medium'
            ELSE 'low'
          END as impact,
          'legacy_migration' as source
        FROM trading_signals 
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trading_signals')
        ON CONFLICT DO NOTHING
      `);
      
      // Migrate market regimes → market events  
      await db.execute(sql`
        INSERT INTO "marketEvents" (event_type, timestamp, data, confidence, impact, source)
        SELECT 
          'regime_change' as event_type,
          detected_at as timestamp,
          json_build_object(
            'regime', regime_type,
            'volatility', volatility,
            'trend', trend_direction,
            'indicators', indicators
          ) as data,
          confidence,
          'high' as impact,
          'legacy_migration' as source
        FROM market_regimes 
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_regimes')
        ON CONFLICT DO NOTHING
      `);
      
      // Migrate sentiment data → market events
      await db.execute(sql`
        INSERT INTO "marketEvents" (event_type, symbol, timestamp, data, confidence, impact, source, tags)
        SELECT 
          'sentiment_shift' as event_type,
          symbol,
          created_at as timestamp,
          json_build_object(
            'sentiment_score', sentiment_score,
            'volume', mention_volume,
            'sources', sources,
            'keywords', keywords
          ) as data,
          LEAST(confidence, 1.0) as confidence,
          CASE 
            WHEN ABS(sentiment_score) > 0.7 THEN 'high'
            WHEN ABS(sentiment_score) > 0.3 THEN 'medium'
            ELSE 'low'
          END as impact,
          'legacy_migration' as source,
          ARRAY[
            CASE WHEN sentiment_score > 0.2 THEN 'bullish' WHEN sentiment_score < -0.2 THEN 'bearish' ELSE 'neutral' END,
            'sentiment'
          ]
        FROM sentiment_data 
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentiment_data')
        ON CONFLICT DO NOTHING
      `);
      
      // Migrate agent memories → agent activities
      await db.execute(sql`
        INSERT INTO "agentActivities" (agent_type, activity, confidence, data, "userId", created_at)
        SELECT 
          COALESCE(agent_name, 'unknown') as agent_type,
          COALESCE(memory_content, 'Legacy memory') as activity,
          LEAST(COALESCE(importance, 0.5), 1.0) as confidence,
          json_build_object(
            'context', context,
            'triggers', triggers,
            'outcomes', outcomes,
            'legacy_id', id
          ) as data,
          user_id as "userId",
          created_at
        FROM agent_memories 
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_memories')
        ON CONFLICT DO NOTHING
      `);
      
      console.log('✅ Data migration completed');
      
      // Drop legacy tables (commented out for safety)
      console.log('⚠️  Legacy tables preserved for manual cleanup');
      console.log('   Run these commands manually after verification:');
      console.log('   DROP TABLE IF EXISTS trading_signals CASCADE;');
      console.log('   DROP TABLE IF EXISTS market_regimes CASCADE;');
      console.log('   DROP TABLE IF EXISTS sentiment_data CASCADE;');
      console.log('   DROP TABLE IF EXISTS agent_memories CASCADE;');
      console.log('   DROP TABLE IF EXISTS trading_strategies CASCADE;');
      
    } else {
      console.log('✨ Clean database - no legacy data to migrate');
    }
    
    // 3. Create indexes for performance
    console.log('🔍 Creating optimized indexes...');
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_events_compound ON "marketEvents" (symbol, event_type, timestamp DESC)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_performance ON positions (status, "userId", symbol)`);
    await db.execute(sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_analytics ON trades ("userId", symbol, executed_at DESC)`);
    
    console.log('🎉 Schema transition completed successfully!');
    console.log('📊 New optimized schema with 8-10 core tables is ready');
    
  } catch (error) {
    console.error('❌ Schema transition failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateToOptimizedSchema()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migrateToOptimizedSchema };