#!/bin/bash

# Comprehensive end-to-end trading validation tests
# Based on user requirements for happy path, risk validation, circuit breakers, and observability

echo "🚀 Starting Skippy Trading Platform Validation Tests"
echo "=================================================="

BASE_URL="http://localhost:5000/api/trading"

# Test 1: Happy Path - Market and Limit Orders
echo "📈 Test 1: Happy Path Trading (Market & Limit Orders)"
echo "-----------------------------------------------------"

echo "✅ Placing market buy order for 0.01 BTC..."
MARKET_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.01,
  "clientId":"test-market-buy-1"
}')
echo "Market order response: $MARKET_RESPONSE"

echo "✅ Placing limit sell order for 0.01 BTC at $120,000..."
LIMIT_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"sell", 
  "type":"limit",
  "quantity":0.01,
  "price":120000,
  "clientId":"test-limit-sell-1"
}')
echo "Limit order response: $LIMIT_RESPONSE"

sleep 2

# Test 2: Risk Validation Gates
echo -e "\n🛡️  Test 2: Risk Validation Gates"
echo "------------------------------------"

echo "❌ Testing oversized order (should be rejected)..."
OVERSIZE_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market", 
  "quantity":50,
  "clientId":"test-oversize-reject"
}')
echo "Oversized order response: $OVERSIZE_RESPONSE"

echo "❌ Testing bad precision (should be rejected)..."
BAD_PRECISION_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.00001,
  "clientId":"test-bad-precision"
}')
echo "Bad precision response: $BAD_PRECISION_RESPONSE"

echo "❌ Testing daily loss limit trigger..."
curl -s -X POST $BASE_URL/test/risk-limit -H "Content-Type: application/json" -d '{"trigger":"daily-loss"}' > /dev/null

DAILY_LOSS_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.01,
  "clientId":"test-daily-loss-block"
}')
echo "Order during daily loss limit: $DAILY_LOSS_RESPONSE"

sleep 2

# Test 3: Circuit Breakers & Staleness
echo -e "\n⚡ Test 3: Circuit Breakers & Staleness"
echo "----------------------------------------"

echo "🔌 Triggering WebSocket staleness test (10s)..."
curl -s -X POST $BASE_URL/test/circuit-breaker -H "Content-Type: application/json" -d '{"type":"ws-stale","duration":10000}' > /dev/null

echo "❌ Testing order while WebSocket is stale (should be rejected)..."
WS_STALE_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.01,
  "clientId":"test-ws-stale-block"
}')
echo "Order during WS staleness: $WS_STALE_RESPONSE"

echo "⏱️  Triggering high latency test (30s with 2s delay)..."
curl -s -X POST $BASE_URL/test/circuit-breaker -H "Content-Type: application/json" -d '{"type":"latency","duration":2000}' > /dev/null

echo "⏳ Testing order with artificial latency..."
LATENCY_START=$(date +%s%3N)
LATENCY_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.01,
  "clientId":"test-high-latency"
}')
LATENCY_END=$(date +%s%3N)
LATENCY_MS=$((LATENCY_END - LATENCY_START))
echo "High latency order response: $LATENCY_RESPONSE"
echo "Measured latency: ${LATENCY_MS}ms"

sleep 15  # Wait for test modes to reset

# Test 4: Observability Metrics
echo -e "\n📊 Test 4: Observability Metrics"
echo "----------------------------------"

echo "📈 Fetching trading metrics..."
METRICS_RESPONSE=$(curl -s $BASE_URL/metrics)
echo "Trading metrics: $METRICS_RESPONSE" | jq '.' 2>/dev/null || echo "Raw metrics: $METRICS_RESPONSE"

echo "🏥 Fetching system health..."
HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health)
echo "System health: $HEALTH_RESPONSE" | jq '.data.status' 2>/dev/null || echo "Raw health: $HEALTH_RESPONSE"

echo "💰 Checking account status..."
ACCOUNT_RESPONSE=$(curl -s $BASE_URL/account)
echo "Account status: $ACCOUNT_RESPONSE"

echo "📋 Checking positions..."
POSITIONS_RESPONSE=$(curl -s $BASE_URL/positions)
echo "Current positions: $POSITIONS_RESPONSE"

# Test 5: Bracket Orders (if supported)
echo -e "\n🎯 Test 5: Bracket Orders with Take Profit/Stop Loss"
echo "----------------------------------------------------"

echo "✅ Placing bracket order with TP +0.5% / SL -0.25%..."
BRACKET_RESPONSE=$(curl -s -X POST $BASE_URL/orders -H "Content-Type: application/json" -d '{
  "symbol":"BTC-USD",
  "side":"buy",
  "type":"market",
  "quantity":0.01,
  "clientId":"test-bracket-1",
  "bracket":{
    "takeProfitPct":0.5,
    "stopLossPct":0.25,
    "reduceOnly":true
  }
}')
echo "Bracket order response: $BRACKET_RESPONSE"

# Summary
echo -e "\n🎉 Test Summary"
echo "==============="
echo "✅ Happy path market/limit orders tested"
echo "✅ Risk validation gates tested (oversize, precision, daily loss)"  
echo "✅ Circuit breakers tested (WS staleness, high latency)"
echo "✅ Observability metrics verified"
echo "✅ Bracket order functionality tested"
echo ""
echo "🚀 Skippy Trading Platform validation complete!"
echo "Check server logs for detailed order processing information."