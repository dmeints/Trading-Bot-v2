import { vectorService } from '../../server/services/vectorService';
import { logger } from '../../server/utils/logger';
// Note: Using console.log with colors instead of chalk for now

export async function rebuildIndex(): Promise<void> {
  try {
    console.log('🔄 Starting complete vector index rebuild...');
    
    await vectorService.initialize();
    
    const startTime = Date.now();
    const result = await vectorService.runFullReindex();
    const duration = Date.now() - startTime;
    
    console.log('✅ Vector index rebuild completed!');
    console.log(`📊 Indexed records:`);
    console.log(`   • Trades: ${result.trades}`);
    console.log(`   • AI Signals: ${result.signals}`);
    console.log(`   • Backtests: ${result.backtests}`);
    console.log(`   • Total: ${result.trades + result.signals + result.backtests}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Vector index rebuild failed:', error);
    process.exit(1);
  }
}

export async function queryIndex(options: { id?: string; top?: string }): Promise<void> {
  try {
    const { id, top = '5' } = options;
    
    if (!id) {
      console.error('❌ Record ID is required. Use --id <recordId>');
      process.exit(1);
    }
    
    console.log(`🔍 Finding ${top} similar records for ID: ${id}`);
    
    await vectorService.initialize();
    
    const results = await vectorService.findSimilarById(id, parseInt(top));
    
    if (results.length === 0) {
      console.log('⚠️  No similar records found');
      return;
    }
    
    console.log(`✅ Found ${results.length} similar records:`);
    console.log();
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.id}`);
      console.log(`   Type: ${result.type}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(2)}%`);
      console.log(`   Timestamp: ${result.timestamp.toISOString()}`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      
      if (Object.keys(result.metadata).length > 0) {
        console.log(`   Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
      }
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Vector query failed:', error);
    process.exit(1);
  }
}