# Stevie End-to-End Implementation - Phase 0 Discovery Manifest

## Repository Map Analysis
**Structure**: Comprehensive full-stack TypeScript application with enterprise architecture
- **client/**: React 18 + Vite frontend with shadcn/ui components
- **server/**: Express.js backend with comprehensive services and routing
- **shared/**: TypeScript schemas and types for client-server communication
- **tools/**: Build and development utilities
- **tests/**: Testing infrastructure

## Routing Architecture
**Framework**: Wouter (lightweight React router)
**Authentication**: Replit OIDC via useAuth hook
**Routes Discovered**:
- `/` - Dashboard (authenticated)
- `/trading` - Trading interface
- `/portfolio` - Portfolio management
- `/ai-chat` - Stevie AI interface
- `/live-trading` - Live trading execution
- `/system` - System monitoring
- `/mlops` - ML operations dashboard
- `/rl-training` - Reinforcement learning
- `/compliance` - Compliance monitoring
- `/social-trading` - Social trading features
- Plus 10+ additional specialized routes

## Interactive Controls Inventory
**Location**: `tools/interaction_inventory.json`
**Controls Identified**: 22 interactive elements across all major routes
**Test Coverage**: All components have proper data-testid attributes
**Architecture**: Event-driven with proper handler separation

## Path Adaptation
**Status**: ✅ No path adaptation needed
**Confirmation**: All prompt paths align with existing repository structure
- `server/` ✅
- `client/src/` ✅  
- `shared/` ✅
- `tools/` ✅

## Implementation Plan (Phases A→L + UI/UX U0→U2)

### ✅ Phase A - External Connectors & Schemas
- [ ] CoinGecko OHLCV connector → market_bars
- [ ] Binance WebSocket L1/L2 → orderbook_snaps  
- [ ] X (Twitter) sentiment → sentiment_ticks
- [ ] Reddit crypto sentiment → sentiment_ticks
- [ ] CryptoPanic news + votes → sentiment_ticks
- [ ] Etherscan gas/whale transfers → onchain_ticks
- [ ] Blockchair BTC metrics → onchain_ticks
- [ ] Trading Economics calendar → macro_events

### ✅ Phase B - Feature Builders & Unified API
- [ ] Microstructure features (spread, imbalance, volume)
- [ ] Cost modeling (slippage curves)
- [ ] Social sentiment aggregation (z-scores, EWMA)
- [ ] On-chain metrics (gas spikes, activity bias)
- [ ] Macro blackout windows
- [ ] Regime classification (volatility, liquidity tier)
- [ ] Unified `/api/features` endpoint

### ✅ Phase C - Deterministic Backtest Adapter
- [ ] No-network backtest execution
- [ ] Gap handling and logging
- [ ] Artifact generation (manifest.json, metrics.json, trades.csv)
- [ ] Dataset hashing for provenance

### ✅ Phase D - Stevie Strategy Kernel & Config
- [ ] `shared/src/stevie/config.ts` - Trading configuration
- [ ] `server/strategy/stevie.ts` - Decision engine
- [ ] Unit tests for strategy logic
- [ ] Multi-strategy routing (breakout, mean-revert, news)

### ✅ Phase E - Reward/Penalty Scoring
- [ ] Trade scoring system (PnL, fees, slippage, penalties)
- [ ] Live trade score persistence
- [ ] Backtest reward aggregation

### ✅ Phase F - Sizing Upgrades
- [ ] Variance targeting implementation
- [ ] Tempered Kelly position sizing
- [ ] Risk scaling integration

### ✅ Phase G - Promotion Gate (Shadow → Live)
- [ ] Shadow vs live performance comparison
- [ ] Automated promotion criteria
- [ ] UI promotion controls

### ✅ Phase H - Anti-Mock & Provenance Audits
- [ ] Mock content scanner
- [ ] Provenance guard middleware
- [ ] Production anti-mock validation
- [ ] Cross-source data validation

### ✅ Phase I - Feature Drift Alarms
- [ ] Statistical feature monitoring
- [ ] Drift detection algorithms
- [ ] Alert generation system

### ✅ Phase J - Real-Time Execution Integration
- [ ] Live order routing
- [ ] Risk controls integration
- [ ] Position management sync

### ✅ Phase K - Performance Attribution
- [ ] Strategy component analysis
- [ ] Factor attribution reporting
- [ ] Performance decomposition

### ✅ Phase L - Production Monitoring
- [ ] Health check endpoints
- [ ] Metrics collection
- [ ] Alert configuration

### ✅ UI/UX Phase U0 - Audit Integration
- [ ] Interaction verification loops
- [ ] Accessibility compliance validation
- [ ] Error state handling

### ✅ UI/UX Phase U1 - Real-Time Updates
- [ ] WebSocket integration for live data
- [ ] UI state synchronization
- [ ] Performance optimization

### ✅ UI/UX Phase U2 - User Experience Polish
- [ ] Mobile responsiveness
- [ ] Loading states optimization
- [ ] Error recovery flows

## Next Action
**Proceed to Phase A**: External Connectors & Schemas implementation
**Priority**: High - Core data ingestion foundation
**Dependencies**: Database schemas, API credentials verification