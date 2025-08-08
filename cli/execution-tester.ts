#!/usr/bin/env tsx

/**
 * CLI TOOL: EXECUTION & LOB TESTING
 * Command-line interface for testing order execution and LOB simulation
 * Part of Phase 6: LOB Simulation and Smart Order Routing
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { executionEngine } from '../server/services/executionEngine.js';
import { orderBookSimulator, smartOrderRouter } from '../server/services/orderBookSimulation.js';
import { riskManagementService } from '../server/services/riskManagement.js';

const program = new Command();

program
  .name('execution-tester')
  .description('Stevie Execution & LOB Testing CLI')
  .version('1.0.0');

// Test order book simulation
program
  .command('test-orderbook')
  .description('Test the order book simulation system')
  .option('-s, --symbol <symbol>', 'Symbol to test', 'BTC')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '10')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📊 Testing Order Book Simulation...\n'));

    try {
      await orderBookSimulator.initialize();
      
      const symbol = options.symbol;
      const duration = parseInt(options.duration) * 1000;
      
      console.log(chalk.cyan(`Testing ${symbol} order book for ${options.duration} seconds...`));
      
      // Monitor order book updates
      let updateCount = 0;
      orderBookSimulator.on('orderBookUpdate', (orderBook) => {
        updateCount++;
        
        if (updateCount % 10 === 0) { // Log every 10th update
          console.log(chalk.yellow(`📈 ${orderBook.symbol} Update #${updateCount}:`));
          console.log(chalk.gray(`  Mid Price: $${orderBook.midPrice.toFixed(2)}`));
          console.log(chalk.gray(`  Spread: $${orderBook.spread.toFixed(4)}`));
          console.log(chalk.gray(`  Best Bid: $${orderBook.bids[0]?.price.toFixed(2)} (${orderBook.bids[0]?.volume.toFixed(3)})`));
          console.log(chalk.gray(`  Best Ask: $${orderBook.asks[0]?.price.toFixed(2)} (${orderBook.asks[0]?.volume.toFixed(3)})`));
          console.log(chalk.gray(`  Depth: Bid ${orderBook.depth.bid.toFixed(2)} | Ask ${orderBook.depth.ask.toFixed(2)}`));
        }
      });
      
      // Test market impact calculation
      setTimeout(() => {
        console.log(chalk.cyan('\n🎯 Testing Market Impact Calculation:'));
        
        const testSizes = [0.1, 0.5, 1.0, 5.0];
        for (const size of testSizes) {
          const buyImpact = orderBookSimulator.calculateMarketImpact(symbol, 'buy', size);
          const sellImpact = orderBookSimulator.calculateMarketImpact(symbol, 'sell', size);
          
          console.log(chalk.yellow(`  Size ${size}: Buy ${buyImpact.priceImpact.toFixed(1)}bp | Sell ${sellImpact.priceImpact.toFixed(1)}bp`));
        }
      }, duration / 2);
      
      // Complete test
      setTimeout(() => {
        console.log(chalk.green.bold(`\n✅ Order book test completed! (${updateCount} updates)`));
        
        const finalOrderBook = orderBookSimulator.getOrderBook(symbol);
        if (finalOrderBook) {
          console.log(chalk.cyan('\n📊 Final Order Book State:'));
          console.log(chalk.yellow(`  Symbol: ${finalOrderBook.symbol}`));
          console.log(chalk.yellow(`  Mid Price: $${finalOrderBook.midPrice.toFixed(2)}`));
          console.log(chalk.yellow(`  Spread: $${finalOrderBook.spread.toFixed(4)} (${(finalOrderBook.spread / finalOrderBook.midPrice * 10000).toFixed(1)}bp)`));
          console.log(chalk.yellow(`  Total Depth: ${(finalOrderBook.depth.bid + finalOrderBook.depth.ask).toFixed(2)}`));
        }
        
        process.exit(0);
      }, duration);
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Order book test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Test smart order routing
program
  .command('test-routing')
  .description('Test the smart order routing system')
  .option('-s, --symbol <symbol>', 'Symbol to test', 'BTC')
  .option('-q, --quantity <amount>', 'Order quantity', '1.0')
  .option('--side <side>', 'Order side (buy/sell)', 'buy')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧠 Testing Smart Order Routing...\n'));

    try {
      await orderBookSimulator.initialize();
      await smartOrderRouter.initialize();
      
      const symbol = options.symbol;
      const quantity = parseFloat(options.quantity);
      const side = options.side as 'buy' | 'sell';
      
      console.log(chalk.cyan(`Routing ${side} order: ${quantity} ${symbol}`));
      
      // Test different order types
      const orderTypes = [
        { type: 'market', timeInForce: 'IOC' },
        { type: 'limit', timeInForce: 'GTC' },
        { type: 'limit', timeInForce: 'IOC' }
      ];
      
      for (const orderType of orderTypes) {
        console.log(chalk.yellow(`\n📋 Testing ${orderType.type} order (${orderType.timeInForce}):`));
        
        const orderBook = orderBookSimulator.getOrderBook(symbol);
        const referencePrice = orderBook?.midPrice || 50000;
        
        const orderParams = {
          symbol,
          side,
          type: orderType.type as 'market' | 'limit',
          quantity,
          remainingQuantity: quantity,
          price: orderType.type === 'limit' ? referencePrice : undefined,
          timeInForce: orderType.timeInForce as 'GTC' | 'IOC'
        };
        
        const sorResult = smartOrderRouter.routeOrder(orderParams);
        
        console.log(chalk.green(`  Strategy: ${sorResult.strategy}`));
        console.log(chalk.gray(`  Child Orders: ${sorResult.childOrders.length}`));
        console.log(chalk.gray(`  Est. Fill Time: ${sorResult.estimatedFillTime}ms`));
        console.log(chalk.gray(`  Est. Cost: $${sorResult.estimatedCost.toFixed(2)}`));
        console.log(chalk.gray(`  Reasoning: ${sorResult.reasoning}`));
        
        // Show child order details
        sorResult.childOrders.forEach((child, i) => {
          const delay = child.delay ? ` (delay: ${child.delay}ms)` : '';
          const price = child.price ? ` @ $${child.price.toFixed(2)}` : '';
          console.log(chalk.gray(`    Child ${i + 1}: ${child.quantity.toFixed(3)}${price}${delay}`));
        });
      }
      
      console.log(chalk.green.bold('\n✅ Smart order routing test completed!'));
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Smart order routing test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Test order execution
program
  .command('test-execution')
  .description('Test the order execution engine')
  .option('-s, --symbol <symbol>', 'Symbol to test', 'BTC')
  .option('-q, --quantity <amount>', 'Order quantity', '0.1')
  .option('--side <side>', 'Order side (buy/sell)', 'buy')
  .option('--type <type>', 'Order type (market/limit)', 'market')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n⚡ Testing Order Execution...\n'));

    try {
      await executionEngine.initialize();
      await riskManagementService.initialize();
      
      const symbol = options.symbol;
      const quantity = parseFloat(options.quantity);
      const side = options.side as 'buy' | 'sell';
      const type = options.type as 'market' | 'limit';
      
      console.log(chalk.cyan(`Executing ${type} order: ${side} ${quantity} ${symbol}`));
      
      // Get current order book for limit price
      const orderBook = orderBookSimulator.getOrderBook(symbol);
      const limitPrice = type === 'limit' && orderBook
        ? (side === 'buy' ? orderBook.bids[0]?.price : orderBook.asks[0]?.price)
        : undefined;
      
      // Submit order
      const { orderId, sorResult } = await executionEngine.submitOrder({
        symbol,
        side,
        type,
        quantity,
        price: limitPrice,
        timeInForce: 'GTC'
      });
      
      console.log(chalk.green(`✅ Order submitted: ${orderId}`));
      console.log(chalk.yellow(`  SOR Strategy: ${sorResult.strategy}`));
      console.log(chalk.yellow(`  Child Orders: ${sorResult.childOrders.length}`));
      
      // Monitor execution
      let filled = false;
      
      executionEngine.on('orderFilled', (order, result) => {
        if (order.id === orderId) {
          filled = true;
          
          console.log(chalk.green.bold('\n🎉 Order Filled!'));
          console.log(chalk.yellow(`  Status: ${result.status}`));
          console.log(chalk.yellow(`  Quantity: ${result.totalQuantity}`));
          console.log(chalk.yellow(`  Average Price: $${result.averagePrice.toFixed(2)}`));
          console.log(chalk.yellow(`  Total Fees: $${result.totalFees.toFixed(2)}`));
          console.log(chalk.yellow(`  Execution Time: ${result.executionTime}ms`));
          console.log(chalk.yellow(`  Slippage: ${(result.slippage * 10000).toFixed(1)}bp`));
          console.log(chalk.yellow(`  Market Impact: ${(result.marketImpact * 10000).toFixed(1)}bp`));
          console.log(chalk.yellow(`  Quality: ${result.executionQuality}`));
          
          console.log(chalk.cyan(`\n📋 Fill Details (${result.fills.length} fills):`));
          result.fills.forEach((fill, i) => {
            console.log(chalk.gray(`  Fill ${i + 1}: ${fill.quantity} @ $${fill.price.toFixed(2)} (fee: $${fill.fees.toFixed(2)})`));
          });
        }
      });
      
      executionEngine.on('orderPartialFill', (order) => {
        if (order.id === orderId) {
          console.log(chalk.yellow(`📊 Partial Fill: ${order.quantity - order.remainingQuantity}/${order.quantity}`));
        }
      });
      
      executionEngine.on('orderCancelled', (order) => {
        if (order.id === orderId) {
          filled = true;
          console.log(chalk.red(`❌ Order Cancelled: ${order.id}`));
        }
      });
      
      // Wait for execution or timeout
      let timeout = 0;
      const checkInterval = setInterval(() => {
        timeout += 500;
        
        if (filled) {
          clearInterval(checkInterval);
          
          // Show execution metrics
          setTimeout(() => {
            const metrics = executionEngine.getExecutionMetrics();
            console.log(chalk.cyan('\n📊 Execution Metrics:'));
            console.log(chalk.yellow(`  Total Orders: ${metrics.totalOrders}`));
            console.log(chalk.yellow(`  Fill Rate: ${(metrics.fillRate * 100).toFixed(1)}%`));
            console.log(chalk.yellow(`  Avg Slippage: ${(metrics.averageSlippage * 10000).toFixed(1)}bp`));
            console.log(chalk.yellow(`  Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`));
            console.log(chalk.yellow(`  Quality Distribution:`));
            console.log(chalk.gray(`    Excellent: ${(metrics.qualityScores.excellent * 100).toFixed(1)}%`));
            console.log(chalk.gray(`    Good: ${(metrics.qualityScores.good * 100).toFixed(1)}%`));
            console.log(chalk.gray(`    Fair: ${(metrics.qualityScores.fair * 100).toFixed(1)}%`));
            console.log(chalk.gray(`    Poor: ${(metrics.qualityScores.poor * 100).toFixed(1)}%`));
            
            process.exit(0);
          }, 1000);
          
        } else if (timeout > 30000) { // 30 second timeout
          clearInterval(checkInterval);
          console.log(chalk.red.bold('\n⏰ Execution timeout - order may still be pending'));
          
          const activeOrders = executionEngine.getActiveOrders();
          console.log(chalk.yellow(`Active orders: ${activeOrders.length}`));
          
          process.exit(0);
        }
      }, 500);
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Order execution test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Stress test execution system
program
  .command('stress-test')
  .description('Stress test the execution system with multiple orders')
  .option('-n, --orders <number>', 'Number of orders to submit', '10')
  .option('-s, --symbol <symbol>', 'Symbol to test', 'BTC')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔥 Stress Testing Execution System...\n'));

    try {
      await executionEngine.initialize();
      await riskManagementService.initialize();
      
      const numOrders = parseInt(options.orders);
      const symbol = options.symbol;
      
      console.log(chalk.cyan(`Submitting ${numOrders} orders for ${symbol}...`));
      
      const startTime = Date.now();
      const submittedOrders: string[] = [];
      let completedOrders = 0;
      
      // Track completions
      executionEngine.on('orderFilled', () => {
        completedOrders++;
        console.log(chalk.green(`✅ Order ${completedOrders}/${numOrders} completed`));
      });
      
      // Submit orders
      for (let i = 0; i < numOrders; i++) {
        const side = Math.random() < 0.5 ? 'buy' : 'sell';
        const type = Math.random() < 0.7 ? 'market' : 'limit';
        const quantity = 0.01 + Math.random() * 0.1; // 0.01 to 0.11
        
        try {
          const { orderId } = await executionEngine.submitOrder({
            symbol,
            side,
            type,
            quantity,
            timeInForce: 'GTC'
          });
          
          submittedOrders.push(orderId);
          
          if (i % 10 === 0) {
            console.log(chalk.yellow(`Submitted ${i + 1}/${numOrders} orders...`));
          }
          
          // Small delay between orders
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.log(chalk.red(`Order ${i + 1} failed: ${(error as Error).message}`));
        }
      }
      
      const submissionTime = Date.now() - startTime;
      console.log(chalk.cyan(`\n📊 Submitted ${submittedOrders.length}/${numOrders} orders in ${submissionTime}ms`));
      
      // Wait for completions
      const waitStart = Date.now();
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - waitStart;
        
        if (completedOrders >= submittedOrders.length) {
          clearInterval(checkInterval);
          
          const totalTime = Date.now() - startTime;
          const metrics = executionEngine.getExecutionMetrics();
          
          console.log(chalk.green.bold('\n🎉 Stress Test Completed!'));
          console.log(chalk.yellow(`  Total Time: ${totalTime}ms`));
          console.log(chalk.yellow(`  Orders Submitted: ${submittedOrders.length}`));
          console.log(chalk.yellow(`  Orders Completed: ${completedOrders}`));
          console.log(chalk.yellow(`  Success Rate: ${(completedOrders / submittedOrders.length * 100).toFixed(1)}%`));
          console.log(chalk.yellow(`  Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`));
          console.log(chalk.yellow(`  Throughput: ${(submittedOrders.length / (totalTime / 1000)).toFixed(1)} orders/sec`));
          
          process.exit(0);
          
        } else if (elapsed > 60000) { // 1 minute timeout
          clearInterval(checkInterval);
          console.log(chalk.red.bold('\n⏰ Stress test timeout'));
          console.log(chalk.yellow(`Completed: ${completedOrders}/${submittedOrders.length}`));
          process.exit(0);
        }
      }, 1000);
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Stress test failed'));
      console.log(chalk.red((error as Error).message));
    }
  });

// Show execution metrics
program
  .command('metrics')
  .description('Show current execution metrics')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 Execution System Metrics\n'));

    try {
      const metrics = executionEngine.getExecutionMetrics();
      const activeOrders = executionEngine.getActiveOrders();
      const recentHistory = executionEngine.getExecutionHistory(10);
      
      console.log(chalk.cyan('📈 Performance Metrics:'));
      console.log(chalk.yellow(`  Total Orders: ${metrics.totalOrders}`));
      console.log(chalk.yellow(`  Fill Rate: ${(metrics.fillRate * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Average Slippage: ${(metrics.averageSlippage * 10000).toFixed(1)}bp`));
      console.log(chalk.yellow(`  Average Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`));
      console.log(chalk.yellow(`  Total Fees: $${metrics.totalFees.toFixed(2)}`));
      console.log(chalk.yellow(`  VWAP Performance: ${(metrics.vwapPerformance * 10000).toFixed(1)}bp avg deviation`));
      
      console.log(chalk.cyan('\n🎯 Quality Distribution:'));
      console.log(chalk.green(`  Excellent: ${(metrics.qualityScores.excellent * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Good: ${(metrics.qualityScores.good * 100).toFixed(1)}%`));
      console.log(chalk.yellow(`  Fair: ${(metrics.qualityScores.fair * 100).toFixed(1)}%`));
      console.log(chalk.red(`  Poor: ${(metrics.qualityScores.poor * 100).toFixed(1)}%`));
      
      console.log(chalk.cyan(`\n📋 Active Orders: ${activeOrders.length}`));
      if (activeOrders.length > 0) {
        activeOrders.slice(0, 5).forEach(order => {
          console.log(chalk.gray(`  ${order.id}: ${order.side} ${order.remainingQuantity}/${order.quantity} ${order.symbol}`));
        });
        if (activeOrders.length > 5) {
          console.log(chalk.gray(`  ... and ${activeOrders.length - 5} more`));
        }
      }
      
      console.log(chalk.cyan(`\n📜 Recent Executions: ${recentHistory.length}`));
      recentHistory.slice(0, 5).forEach(result => {
        const qualityColor = result.executionQuality === 'excellent' ? chalk.green :
                            result.executionQuality === 'good' ? chalk.yellow :
                            result.executionQuality === 'fair' ? chalk.yellow : chalk.red;
        
        console.log(chalk.gray(`  ${result.orderId}: ${result.totalQuantity} @ $${result.averagePrice.toFixed(2)} `));
        console.log(qualityColor(`    Quality: ${result.executionQuality} (${(result.slippage * 10000).toFixed(1)}bp slippage)`));
      });
      
    } catch (error) {
      console.log(chalk.red.bold('❌ Failed to get metrics'));
      console.log(chalk.red((error as Error).message));
    }
  });

program.parse();