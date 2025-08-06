# Skippy Trading Platform - Gap Remediation Plan

## Prioritized Task List
**Estimated Total Time**: ~12-16 hours across 8 focused tasks

### Priority 1: Core RL & Policy Engine (High Impact, 4-6 hours)

#### Task 1: Create Policy Engine Foundation
**Files**: 
- `server/engine/policy.ts` (new)
- `server/engine/__tests__/policy.test.ts` (new)
- `.env` (add variables)

**Environment Variables**:
```bash
CONF_MIN_THRESHOLD=0.85
MAX_LOSS_STREAK=3
COOLDOWN_MINUTES=60
DAILY_TRADE_CAP=15
RISK_FACTOR_THRESHOLD=2.5
```

**Acceptance Criteria**:
- Policy blocks trades below confidence threshold
- Cooldown activates after loss streak
- Daily cap enforced per user
- All thresholds configurable via environment
- Unit tests cover edge cases
- Integration with existing trade execution flow

**Estimated Time**: 2 hours

#### Task 2: Implement RL Inference System
**Files**:
- `server/engine/rl.ts` (new)
- `server/routes.ts` (add `/api/rl/predict`)
- `models/` directory structure (new)

**API Endpoint**: `/api/rl/predict`
**Request**: `{ symbol: string, features: MarketFeatures }`
**Response**: `{ action: 'buy'|'sell'|'hold', confidence: number, rationale: string }`

**Acceptance Criteria**:
- Loads PPO weights from model files
- Returns action/confidence using market features
- Logs features used for predictions
- Handles model loading errors gracefully
- Integrates with policy engine for final decisions

**Estimated Time**: 3 hours

### Priority 2: Simulation & Backtesting (Medium Impact, 3-4 hours)

#### Task 3: Build Simulation Studio Backend
**Files**:
- `server/engine/backtest.ts` (new)
- `server/routes.ts` (add simulation endpoints)
- `shared/schema.ts` (add simulation tables)

**New Database Tables**:
```sql
-- Add to schema.ts
backtest_runs, backtest_results, synthetic_events
```

**API Endpoints**:
- `POST /api/simulation/backtest` - Run backtest
- `GET /api/simulation/results/:id` - Get results  
- `GET /api/simulation/export/:id` - Export CSV/PDF

**Acceptance Criteria**:
- Runs backtests with historical data
- Generates synthetic market events
- Exports results as CSV
- Stores backtest metadata and results
- Handles large datasets efficiently

**Estimated Time**: 2.5 hours

#### Task 4: Create Simulation Studio UI
**Files**:
- `client/src/pages/SimulationStudio.tsx` (new)
- `client/src/components/simulation/` (new directory)
- Update `client/src/App.tsx` routing

**UI Components**:
- Backtest configuration form
- Results visualization (charts)
- Export controls
- Historical performance comparison

**Acceptance Criteria**:
- Users can configure backtest parameters
- Real-time progress indicators
- Interactive result charts
- Download reports functionality
- Responsive design matches existing pages

**Estimated Time**: 2 hours

### Priority 3: Enhanced UI & User Experience (Medium Impact, 3-4 hours)

#### Task 5: Build Trade Journal & Insights
**Files**:
- `client/src/pages/TradeJournal.tsx` (new)
- `client/src/pages/Insights.tsx` (new)  
- `client/src/components/journal/` (new directory)
- Update routing in `client/src/App.tsx`

**Features**:
- Trade reasoning display with AI rationale
- Model performance comparison charts
- Equity curve visualization
- Strategy performance breakdown
- Searchable trade history

**Acceptance Criteria**:
- Shows detailed trade rationale for each transaction
- Compares model performance over time
- Interactive charts with filtering
- Export journal entries
- Mobile-responsive design

**Estimated Time**: 2.5 hours

#### Task 6: Add Trade Throttling UI Controls
**Files**:
- `client/src/pages/settings.tsx` (update)
- `client/src/components/ui/PolicyControls.tsx` (new)
- `server/routes.ts` (add policy endpoints)

**UI Elements**:
- Policy status indicators
- Cooldown timers
- Risk threshold sliders
- Emergency stop button
- Trade quota displays

**Acceptance Criteria**:
- Users can view current policy status
- Real-time cooldown timers
- Ability to adjust risk parameters
- Visual indicators for throttling state
- Admin override controls

**Estimated Time**: 1.5 hours

### Priority 4: Advanced Features (Lower Impact, 2-3 hours)

#### Task 7: Implement Daily Digest System
**Files**:
- `server/services/digestGenerator.ts` (new)
- `server/index.ts` (add cron job)
- Email template files (new)

**Features**:
- Daily performance summary
- Top recommendations recap
- Risk metrics overview
- Market highlights
- Automated email delivery

**Acceptance Criteria**:
- Generates daily digest at configured time
- Email template with charts/tables
- Export as PDF option
- Configurable delivery preferences
- Handles email failures gracefully

**Estimated Time**: 2 hours

#### Task 8: Add Identity-Preserving Tags
**Files**:
- `shared/schema.ts` (extend trades table)
- `server/routes.ts` (update trade endpoints)
- `client/src/components/trading/` (add tagging UI)

**Schema Changes**:
```sql
-- Add to trades table
strategy_tag varchar(50),
risk_level varchar(20), 
data_sources text[],
custom_tags jsonb
```

**UI Components**:
- Tag selector in trade forms
- Tag filtering in trade history
- Strategy performance by tag
- Custom tag management

**Acceptance Criteria**:
- All trades tagged with strategy/risk/sources
- UI for managing custom tags
- Analytics filtered by tags
- Historical tag analysis
- Bulk tag operations

**Estimated Time**: 1.5 hours

## Implementation Sequence

### Phase 1: Foundation (Day 1, 4-6 hours)
1. Create policy engine (Task 1)
2. Implement RL inference (Task 2)

### Phase 2: Simulation & Strategy (Day 2, 3-4 hours) 
3. Build backtest engine (Task 3)
4. Create simulation UI (Task 4)

### Phase 3: User Experience (Day 3, 3-4 hours)
5. Trade journal & insights (Task 5)  
6. Policy controls UI (Task 6)

### Phase 4: Polish & Automation (Day 4, 2-3 hours)
7. Daily digest system (Task 7)
8. Trade tagging system (Task 8)

## Quick Start Commands

```bash
# Create directory structure
mkdir -p server/engine server/engine/__tests__ models client/src/components/simulation client/src/components/journal

# Add environment variables to .env
echo "CONF_MIN_THRESHOLD=0.85" >> .env
echo "MAX_LOSS_STREAK=3" >> .env  
echo "COOLDOWN_MINUTES=60" >> .env
echo "DAILY_TRADE_CAP=15" >> .env

# Update database schema
npm run db:push

# Start development
npm run dev
```

## Testing Strategy

Each task includes:
- Unit tests for core logic
- Integration tests for API endpoints  
- UI component tests with user interactions
- End-to-end workflow tests

## Dependencies & Prerequisites

- [x] OpenAI API key configured
- [x] Database schema supports extensions
- [ ] Additional environment variables for thresholds
- [ ] Model file storage structure
- [ ] Email service configuration (for digests)

## Success Metrics

- [ ] Policy engine prevents >95% of high-risk trades
- [ ] RL predictions achieve >60% accuracy on backtests
- [ ] Simulation studio handles >1M data points smoothly
- [ ] UI response times <200ms for all new features
- [ ] Zero security regressions in audit tests