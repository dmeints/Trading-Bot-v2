# Skippy CLI Reference

The Skippy CLI (`npm run skippy`) provides comprehensive command-line tools for managing the trading platform, from database operations to AI model management and system monitoring.

## Quick Start

```bash
# Install and setup
npm install
npm run skippy db migrate

# Check system status
npm run skippy system status

# Run a backtest
npm run skippy trade backtest --strategy ema-crossover --period 30
```

## Command Overview

| Command Category | Purpose | Example |
|---|---|---|
| `db` | Database management | `npm run skippy db health` |
| `trade` | Trading and backtesting | `npm run skippy trade backtest` |
| `ai` | AI model operations | `npm run skippy ai retrain` |
| `plugin` | Plugin management | `npm run skippy plugin list` |
| `system` | System monitoring | `npm run skippy system status` |

## Database Commands (`db`)

### `db migrate`
Migrate database to optimized schema design.

```bash
# Dry run (recommended first)
npm run skippy db migrate --dry-run

# Execute migration
npm run skippy db migrate
```

**Options:**
- `--dry-run`: Show migration plan without executing

**Use Cases:**
- Initial setup of optimized schema
- Transitioning from legacy 15+ table design
- Production deployments

### `db health`
Check database connectivity and table status.

```bash
npm run skippy db health
```

**Output:**
- Connection status
- Table row counts
- Database server information
- Performance metrics

### `db init-vectors`
Initialize vector database for AI similarity search.

```bash
npm run skippy db init-vectors
```

**Requirements:**
- PostgreSQL with pgvector extension (optional)
- OpenAI API key for embeddings

## Trading Commands (`trade`)

### `trade backtest`
Run strategy backtesting with historical data.

```bash
# Basic backtest
npm run skippy trade backtest

# Custom parameters
npm run skippy trade backtest \
  --strategy ema-crossover \
  --period 30 \
  --symbols BTC,ETH,SOL
```

**Options:**
- `-s, --strategy <name>`: Strategy name (default: "default")
- `-p, --period <days>`: Backtesting period in days (default: 30)
- `-c, --symbols <symbols>`: Comma-separated symbols (default: "BTC,ETH,SOL")

**Output:**
- Total trades executed
- Win rate percentage
- Average return per trade
- Total return for period

**Example Output:**
```
📊 Backtest Results:
   Total trades: 15
   Profitable trades: 9
   Win rate: 60.0%
   Average return per trade: 1.23%
   Total return: 18.45%
```

### `trade similar`
Find similar trading scenarios using AI vector search.

```bash
npm run skippy trade similar "buying BTC at resistance level during bull market"
```

**Options:**
- `-l, --limit <number>`: Maximum results (default: 5)

**Use Cases:**
- Research historical precedents
- Risk assessment for new trades
- Strategy validation

## AI Commands (`ai`)

### `ai retrain`
Trigger AI model retraining with recent trade data.

```bash
# Retrain market insight agent
npm run skippy ai retrain

# Retrain specific agent
npm run skippy ai retrain --agent risk_assessor
```

**Options:**
- `--agent <type>`: Agent type to retrain (default: "market_insight")

**Process:**
1. Gathers recent trade data (7 days)
2. Analyzes patterns and outcomes
3. Updates model parameters
4. Validates performance
5. Logs retraining activity

## Plugin Commands (`plugin`)

### `plugin list`
Display all available plugins and their status.

```bash
npm run skippy plugin list
```

**Output:**
- Plugin name and version
- Enabled/disabled status
- Performance metrics
- Last execution time

### `plugin enable/disable`
Control plugin activation.

```bash
# Enable a plugin
npm run skippy plugin enable ema-crossover

# Disable a plugin
npm run skippy plugin disable ema-crossover
```

### `plugin test`
Test plugin functionality safely.

```bash
npm run skippy plugin test ema-crossover
```

**Safety Features:**
- Paper trading mode only
- No real money at risk
- Detailed execution logs

### `plugin deploy`
Deploy plugin to live trading.

```bash
# Deploy to paper trading first
npm run skippy plugin deploy ema-crossover --paper

# Deploy to live trading (requires confirmation)
npm run skippy plugin deploy ema-crossover --live
```

### `plugin status`
Show detailed plugin performance metrics.

```bash
npm run skippy plugin status ema-crossover
```

**Metrics Displayed:**
- Signal generation rate
- Trade execution success
- P&L performance
- Error rates

## System Commands (`system`)

### `system status`
Comprehensive system health and metrics.

```bash
npm run skippy system status
```

**Information Displayed:**
- API server status and uptime
- Database connectivity and stats
- User and trading activity
- AI system status
- Recent error counts

**Example Output:**
```
📊 System Status Report

🟢 API Status: healthy
⏰ Uptime: 145.2s
👥 Users: 3
📈 Total trades: 127
💼 Open positions: 8
🤖 AI activities (24h): 45
```

### `system cleanup`
Clean up old data and optimize database.

```bash
# Clean data older than 90 days (default)
npm run skippy system cleanup

# Custom retention period
npm run skippy system cleanup --days 60
```

**Operations:**
- Removes old market data
- Cleans agent activity logs
- Optimizes vector database
- Reports cleanup statistics

**Safety Features:**
- Preserves essential data
- Configurable retention periods
- Detailed cleanup reports

## Advanced Usage

### Combining Commands

```bash
# Full system check and maintenance
npm run skippy db health && \
npm run skippy system status && \
npm run skippy system cleanup --days 30

# Plugin deployment workflow
npm run skippy plugin test my-strategy && \
npm run skippy plugin deploy my-strategy --paper && \
npm run skippy plugin status my-strategy
```

### Automation and Scripting

#### Cron Job Examples

```bash
# Daily health check (5 AM)
0 5 * * * cd /app && npm run skippy system status

# Weekly cleanup (Sunday 2 AM)
0 2 * * 0 cd /app && npm run skippy system cleanup

# Monthly AI retraining (1st of month, 3 AM)
0 3 1 * * cd /app && npm run skippy ai retrain
```

#### CI/CD Integration

```yaml
# GitHub Actions example
- name: Database Health Check
  run: npm run skippy db health

- name: Run Strategy Backtest
  run: npm run skippy trade backtest --period 7 --symbols BTC,ETH

- name: Plugin Testing
  run: npm run skippy plugin test ema-crossover
```

### Configuration and Environment

#### Environment Variables

The CLI respects these environment variables:

```bash
DATABASE_URL=postgresql://...    # Database connection
OPENAI_API_KEY=sk-...           # AI features
NODE_ENV=production             # Environment mode
LOG_LEVEL=info                  # Logging verbosity
```

#### Configuration Files

CLI behavior can be customized via:

- `skippy.config.js` - Global CLI configuration
- `plugins/*/config.json` - Plugin-specific settings
- `.env` - Environment variables

## Error Handling and Debugging

### Common Error Scenarios

#### Database Connection Issues
```bash
# Test connection
npm run skippy db health

# Check environment
echo $DATABASE_URL

# Verify credentials
psql "$DATABASE_URL" -c "SELECT 1"
```

#### Plugin Errors
```bash
# Check plugin logs
npm run skippy plugin status my-plugin

# Test plugin in isolation
npm run skippy plugin test my-plugin

# Verify plugin configuration
npm run skippy plugin config my-plugin
```

#### AI Service Issues
```bash
# Check AI status
npm run skippy ai status

# Verify API key
echo $OPENAI_API_KEY | cut -c1-10

# Test AI connectivity
npm run skippy ai test-connection
```

### Verbose Logging

Enable detailed logging for troubleshooting:

```bash
# Debug mode
DEBUG=skippy:* npm run skippy system status

# Trace mode (very verbose)
LOG_LEVEL=trace npm run skippy trade backtest
```

## Performance Monitoring

### Execution Time Tracking

All CLI commands automatically track execution time:

```bash
npm run skippy trade backtest
# Output includes: ⏱️ Execution time: 2.34s
```

### Resource Usage

Monitor resource consumption:

```bash
# Memory usage
npm run skippy system memory

# Database performance
npm run skippy db performance

# Plugin resource usage
npm run skippy plugin resources
```

## Best Practices

### Development Workflow
1. Always test with `--dry-run` first
2. Use paper trading before live deployment
3. Monitor system status regularly
4. Keep plugins updated and tested

### Production Operations
1. Schedule regular cleanup operations
2. Monitor error rates and performance
3. Backup before major operations
4. Use staged deployments for plugins

### Troubleshooting Checklist
1. Check system status first
2. Verify database connectivity
3. Confirm environment variables
4. Review recent logs
5. Test individual components

## Integration Examples

### Monitoring Scripts

```bash
#!/bin/bash
# Health monitoring script

echo "=== System Health Check ==="
npm run skippy system status

echo -e "\n=== Database Status ==="
npm run skippy db health

echo -e "\n=== Plugin Status ==="
npm run skippy plugin list

echo -e "\n=== Recent Errors ==="
npm run skippy system logs --level error --tail 10
```

### Performance Analysis

```bash
#!/bin/bash
# Performance analysis script

echo "=== Backtest Performance ==="
for strategy in ema-crossover momentum-breakout; do
  echo "Testing $strategy..."
  npm run skippy trade backtest --strategy $strategy --period 30
done

echo -e "\n=== System Performance ==="
npm run skippy system performance
```

### Deployment Validation

```bash
#!/bin/bash
# Post-deployment validation

echo "Validating deployment..."

# Health checks
npm run skippy system status || exit 1
npm run skippy db health || exit 1

# Functionality tests
npm run skippy plugin test --all || exit 1
npm run skippy trade backtest --period 1 || exit 1

echo "✅ Deployment validation successful"
```

## Reference

### Exit Codes
- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: Database error
- `4`: API error
- `5`: Plugin error

### Log Levels
- `error`: Critical errors only
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging
- `trace`: Very verbose output

### Configuration Schema

```typescript
interface SkippyConfig {
  database: {
    maxConnections: number;
    timeoutMs: number;
  };
  ai: {
    modelName: string;
    maxTokens: number;
  };
  plugins: {
    enabled: string[];
    defaultTimeout: number;
  };
  system: {
    logLevel: string;
    metricsInterval: number;
  };
}
```