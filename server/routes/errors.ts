
import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Error pattern tracking for analysis
const errorPatterns = new Map<string, { count: number, lastSeen: number, samples: any[] }>();

router.post('/', async (req, res) => {
  try {
    const errorData = req.body;
    
    // Enhanced error analysis
    const errorPattern = `${errorData.name || 'Unknown'}_${errorData.source || 'component'}`;
    const existing = errorPatterns.get(errorPattern) || { count: 0, lastSeen: 0, samples: [] };
    
    existing.count++;
    existing.lastSeen = Date.now();
    existing.samples.push({
      message: errorData.message,
      url: errorData.url,
      timestamp: errorData.timestamp,
      retryCount: errorData.retryCount || 0
    });
    
    // Keep only last 5 samples per pattern
    if (existing.samples.length > 5) {
      existing.samples = existing.samples.slice(-5);
    }
    
    errorPatterns.set(errorPattern, existing);
    
    // Determine error severity
    const severity = determineSeverity(errorData, existing);
    
    // Enhanced logging with pattern analysis
    logger.error('[ClientError]', {
      errorId: errorData.errorId,
      pattern: errorPattern,
      severity,
      frequency: existing.count,
      message: errorData.message,
      stack: errorData.stack,
      componentStack: errorData.componentStack,
      source: errorData.source,
      timestamp: errorData.timestamp,
      url: errorData.url,
      userAgent: errorData.userAgent,
      viewport: errorData.viewport,
      memory: errorData.memory,
      connection: errorData.connection,
      retryCount: errorData.retryCount,
      sessionId: errorData.sessionId,
      isRecurring: existing.count > 1,
      timeSinceLastOccurrence: existing.count > 1 ? Date.now() - existing.lastSeen : null
    });
    
    // Alert on critical patterns
    if (severity === 'critical' || existing.count > 10) {
      logger.warn('[ClientError] Critical error pattern detected', {
        pattern: errorPattern,
        frequency: existing.count,
        lastSamples: existing.samples
      });
    }
    
    res.json({ 
      success: true, 
      errorId: errorData.errorId,
      pattern: errorPattern,
      frequency: existing.count 
    });
    
  } catch (error) {
    logger.error('[ErrorLogging] Failed to log client error:', error);
    res.status(500).json({ success: false, error: 'Failed to log error' });
  }
});

// Error analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    const analytics = Array.from(errorPatterns.entries()).map(([pattern, data]) => ({
      pattern,
      count: data.count,
      lastSeen: new Date(data.lastSeen).toISOString(),
      recentSamples: data.samples.slice(-3)
    })).sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: {
        totalPatterns: errorPatterns.size,
        totalErrors: Array.from(errorPatterns.values()).reduce((sum, data) => sum + data.count, 0),
        patterns: analytics
      }
    });
  } catch (error) {
    logger.error('[ErrorAnalytics] Failed to get error analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

function determineSeverity(errorData: any, pattern: any): 'low' | 'medium' | 'high' | 'critical' {
  // Critical errors
  if (errorData.message?.includes('out of memory') || 
      errorData.message?.includes('Maximum call stack') ||
      pattern.count > 50) {
    return 'critical';
  }
  
  // High severity
  if (errorData.source === 'global-error' || 
      errorData.message?.includes('TypeError') ||
      pattern.count > 20) {
    return 'high';
  }
  
  // Medium severity
  if (errorData.retryCount > 2 || pattern.count > 5) {
    return 'medium';
  }
  
  return 'low';
}

export default router;
