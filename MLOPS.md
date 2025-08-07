# MLOps Documentation

## Overview

The Skippy Trading Platform includes a comprehensive MLOps pipeline for automated model training, retraining, and performance monitoring. This system enables continuous learning from real trading data and provides explainable insights.

## Architecture

### Core Components

1. **MLOps Service** (`server/services/mlopsService.ts`)
   - Automated retraining pipeline
   - Hyperparameter sweep execution
   - Drift detection and monitoring
   - Model deployment management

2. **Retraining Cron Jobs** (`server/jobs/retrainingCron.ts`)
   - Daily automated retraining (2 AM UTC for Market Insight, 3 AM UTC for Risk Assessor)
   - Drift detection every 6 hours
   - Weekly comprehensive model validation

3. **CLI Tools** (`cli/index.ts`)
   - Manual retraining triggers
   - Hyperparameter sweep management
   - Drift metric monitoring
   - Model status checking

4. **Web Dashboard** (`client/src/pages/MLOpsDashboard.tsx`)
   - Real-time model performance monitoring
   - Drift detection visualization
   - Hyperparameter sweep results
   - Manual retraining controls

## Database Schema

### MLOps Tables

- **model_runs**: Training job metadata and metrics
- **sweep_results**: Hyperparameter sweep outcomes
- **drift_metrics**: Model drift detection results
- **model_deployments**: Deployed model tracking
- **hyperparameter_sweeps**: Sweep configuration and status
- **feature_importance**: Feature importance tracking over time
- **model_performance_history**: Long-term performance metrics
- **training_data_quality**: Training dataset quality assessment

## Usage Guide

### 1. Automated Retraining Pipeline

The system automatically triggers retraining based on:
- Daily schedule (configurable)
- Critical drift detection
- Performance degradation alerts

```bash
# Enable automated jobs (production)
export ENABLE_MLOPS_JOBS=true

# Or via environment variable in production
NODE_ENV=production
```

### 2. Manual Retraining

#### CLI Commands

```bash
# Retrain Market Insight agent
npm run skippy ai retrain --agent market_insight

# Retrain Risk Assessor agent  
npm run skippy ai retrain --agent risk_assessor

# Check model drift
npm run skippy ai drift --agent market_insight

# List deployed models
npm run skippy ai models
```

#### Web Interface

Access the MLOps Dashboard at `/mlops` to:
- Trigger manual retraining
- Monitor real-time drift metrics
- View performance trends
- Analyze feature importance changes

### 3. Hyperparameter Sweeps

#### CLI Usage

```bash
# Run hyperparameter sweep with default grid
npm run skippy ai sweep --agent market_insight

# Use custom configuration file
npm run skippy ai sweep --agent market_insight --config ./custom-sweep.json

# View sweep results
npm run skippy ai sweep-results --sweep-id <sweep-id>
```

#### Configuration Format

Create a JSON file with parameter grid:

```json
{
  "learning_rate": [0.001, 0.01, 0.1],
  "batch_size": [16, 32, 64],
  "risk_threshold": [0.05, 0.1, 0.15],
  "epochs": [50, 100, 200]
}
```

#### API Usage

```bash
# Trigger sweep via API
curl -X POST http://localhost:5000/api/mlops/sweep \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "market_insight",
    "parameter_grid": {
      "learning_rate": [0.001, 0.01],
      "batch_size": [32, 64]
    },
    "name": "Learning Rate Optimization"
  }'
```

### 4. Drift Detection

The system monitors three types of drift:

1. **Feature Drift**: Changes in input feature distributions
2. **Prediction Drift**: Changes in model output distributions  
3. **Performance Drift**: Degradation in model performance metrics

#### Thresholds

- **Feature Drift**: KL divergence > 0.1 (critical), > 0.05 (warning)
- **Prediction Drift**: Wasserstein distance > 0.15 (critical), > 0.1 (warning)
- **Performance Drift**: Sharpe ratio degradation > 5% (critical), > 2% (warning)

#### Manual Drift Check

```bash
# Check all agents
npm run skippy ai drift

# Check specific agent
npm run skippy ai drift --agent market_insight
```

## API Endpoints

### Model Management

- `GET /api/mlops/model-runs` - List training runs
- `GET /api/mlops/model-runs/:id` - Get specific run details
- `POST /api/mlops/retrain` - Trigger manual retraining
- `GET /api/mlops/deployments` - List deployed models

### Hyperparameter Sweeps

- `POST /api/mlops/sweep` - Start hyperparameter sweep
- `GET /api/mlops/sweep-results` - Get sweep results
- `GET /api/mlops/sweep-results?sweep_id=<id>` - Get specific sweep results

### Drift Monitoring

- `POST /api/mlops/drift/calculate` - Calculate drift metrics
- `GET /api/mlops/drift-metrics` - Get drift history
- `GET /api/mlops/drift-metrics?status=critical` - Get critical alerts

### Job Management

- `GET /api/mlops/jobs/status` - Get cron job status
- `POST /api/mlops/jobs/trigger/:jobType` - Manually trigger jobs

### Performance Analytics

- `GET /api/mlops/feature-importance` - Get feature importance data
- `GET /api/mlops/performance-history` - Get model performance over time

## Monitoring and Alerts

### Performance Metrics

The system tracks key metrics for each model:

- **Accuracy**: Prediction correctness
- **Sharpe Ratio**: Risk-adjusted returns
- **Precision/Recall**: Classification performance
- **Validation Loss**: Model training quality

### Alert Conditions

Automatic alerts trigger when:
- Critical drift detected (>= threshold)
- Model performance degrades significantly
- Training failures occur
- Data quality issues detected

### Logging

All MLOps activities are logged with structured data:

```json
{
  "timestamp": "2025-08-07T00:00:00Z",
  "level": "info",
  "message": "Model retraining completed",
  "agent_type": "market_insight",
  "model_version": "v1704672000000",
  "metrics": {
    "accuracy": 0.85,
    "sharpe_ratio": 1.45
  },
  "deployment_status": "deployed"
}
```

## Configuration

### Environment Variables

```bash
# Enable MLOps jobs
ENABLE_MLOPS_JOBS=true

# OpenAI API key for model training
OPENAI_API_KEY=your_key_here

# Database connection
DATABASE_URL=your_database_url
```

### Feature Flags

MLOps functionality can be controlled via feature flags:

- `mlops_auto_retrain`: Enable/disable automatic retraining
- `mlops_drift_detection`: Enable/disable drift monitoring
- `mlops_hyperparameter_sweeps`: Enable/disable sweep functionality

## Best Practices

### 1. Model Retraining

- **Frequency**: Daily retraining for active markets
- **Data Quality**: Ensure minimum 100 samples for retraining
- **Validation**: Always validate on held-out data before deployment
- **Rollback**: Keep previous model versions for quick rollback

### 2. Hyperparameter Optimization

- **Grid Size**: Start with small grids (3x3) before expanding
- **Metrics**: Focus on business metrics (Sharpe ratio) over accuracy
- **Resources**: Limit concurrent experiments based on available compute
- **Documentation**: Record sweep rationale and outcomes

### 3. Drift Monitoring

- **Baseline**: Establish baseline distributions during stable periods
- **Sensitivity**: Adjust thresholds based on market volatility
- **Response**: Have automated responses for critical drift
- **Analysis**: Investigate drift causes, not just symptoms

### 4. Production Deployment

- **Testing**: Thoroughly test in paper trading mode first
- **Gradual Rollout**: Use staged deployments for new models
- **Monitoring**: Monitor performance closely after deployment
- **Fallback**: Maintain fallback to previous model version

## Troubleshooting

### Common Issues

1. **Insufficient Training Data**
   - Ensure minimum sample size (100+ trades)
   - Check data quality metrics
   - Consider extending collection period

2. **Training Failures**
   - Check OpenAI API key and quotas
   - Verify database connectivity
   - Review training data format

3. **High Drift Alerts**
   - Investigate market regime changes
   - Check data pipeline for issues
   - Consider model architecture updates

4. **Performance Degradation**
   - Compare against benchmark periods
   - Analyze feature importance changes
   - Consider emergency retraining

### Debugging Commands

```bash
# Check system health
curl http://localhost:5000/api/health

# View recent model runs
npm run skippy ai models

# Check drift status
npm run skippy ai drift

# View job status
curl http://localhost:5000/api/mlops/jobs/status
```

## Extending the System

### Adding New Agents

1. Update `mlopsService.ts` with new agent type
2. Add agent-specific training logic
3. Update CLI commands and API routes
4. Add monitoring for new agent

### Custom Metrics

1. Extend `ModelRun` interface with new metrics
2. Update training validation logic
3. Add visualization to dashboard
4. Configure alerting thresholds

### Integration Points

- **External ML Platforms**: MLflow, Weights & Biases
- **Alerting Systems**: PagerDuty, Slack, Email
- **Data Sources**: Additional market data feeds
- **Compute Resources**: Cloud ML training services

## Security Considerations

- **API Access**: All MLOps endpoints require authentication
- **Model Data**: Sensitive model parameters are encrypted at rest
- **Audit Trail**: All training activities are logged for compliance
- **Resource Limits**: Training jobs have timeout and resource constraints

## Performance Optimization

- **Lazy Loading**: Services initialize only when needed
- **Caching**: Model metadata cached to reduce database load
- **Parallel Processing**: Hyperparameter sweeps run in parallel
- **Resource Management**: Training jobs respect system resource limits

---

For additional support or questions about the MLOps system, refer to the codebase documentation or contact the development team.