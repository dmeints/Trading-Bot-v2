#!/usr/bin/env python3
"""
Stevie RL Bootstrap - Stable-Baselines3 Integration
Advanced training regime with proven RL algorithms
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import gymnasium as gym
from gymnasium import spaces
from stable_baselines3 import PPO, DQN, A2C
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback, StopTrainingOnRewardThreshold
from stable_baselines3.common.monitor import Monitor
from typing import Dict, Any, Tuple, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StevieRLTradingEnv(gym.Env):
    """
    Stevie's Advanced RL Trading Environment
    Compatible with Stable-Baselines3 and OpenAI Gym
    """
    
    def __init__(self, 
                 market_data: np.ndarray,
                 initial_balance: float = 100000.0,
                 lookback_window: int = 20,
                 transaction_cost: float = 0.001):
        super().__init__()
        
        self.market_data = market_data
        self.initial_balance = initial_balance
        self.lookback_window = lookback_window
        self.transaction_cost = transaction_cost
        
        # State: [price_features, portfolio_features, technical_indicators]
        self.observation_space = spaces.Box(
            low=-np.inf, 
            high=np.inf, 
            shape=(lookback_window * 6 + 4,),  # OHLCV + volume + portfolio state
            dtype=np.float32
        )
        
        # Actions: [0=Hold, 1=Buy, 2=Sell] with position size
        self.action_space = spaces.Discrete(3)
        
        self.reset()
        
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.current_step = self.lookback_window
        self.balance = self.initial_balance
        self.position = 0.0  # Current BTC position
        self.entry_price = 0.0
        self.total_profit = 0.0
        self.trades = []
        
        return self._get_observation(), {}
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        if self.current_step >= len(self.market_data) - 1:
            return self._get_observation(), 0, True, False, {}
        
        current_price = self.market_data[self.current_step][3]  # Close price
        previous_price = self.market_data[self.current_step - 1][3]
        
        # Execute action
        reward = self._execute_trade(action, current_price)
        
        # Update step
        self.current_step += 1
        
        # Calculate portfolio value
        portfolio_value = self.balance + (self.position * current_price)
        
        # Check if done
        done = (self.current_step >= len(self.market_data) - 1) or (portfolio_value <= 0.1 * self.initial_balance)
        
        info = {
            'balance': self.balance,
            'position': self.position,
            'portfolio_value': portfolio_value,
            'total_profit': self.total_profit,
            'current_price': current_price
        }
        
        return self._get_observation(), reward, done, False, info
    
    def _execute_trade(self, action: int, current_price: float) -> float:
        """Execute trading action and return reward"""
        reward = 0.0
        position_size = 0.1  # 10% of portfolio per trade
        
        if action == 1 and self.position == 0:  # Buy
            max_position = (self.balance * position_size) / current_price
            if max_position > 0:
                self.position = max_position
                self.balance -= max_position * current_price * (1 + self.transaction_cost)
                self.entry_price = current_price
                reward = 0.01  # Small reward for taking position
                
        elif action == 2 and self.position > 0:  # Sell
            sell_value = self.position * current_price * (1 - self.transaction_cost)
            profit = sell_value - (self.position * self.entry_price)
            
            self.balance += sell_value
            self.total_profit += profit
            self.position = 0.0
            
            # Reward based on profit/loss
            reward = profit / (self.entry_price * self.position) if self.entry_price > 0 else 0
            
            self.trades.append({
                'entry_price': self.entry_price,
                'exit_price': current_price,
                'profit': profit,
                'return_pct': reward
            })
        
        # Add market movement penalty/reward for holding positions
        if self.position > 0:
            price_change = (current_price - self.market_data[self.current_step - 1][3]) / self.market_data[self.current_step - 1][3]
            reward += price_change * 0.1  # Small reward for beneficial market moves
        
        return reward
    
    def _get_observation(self) -> np.ndarray:
        """Get current state observation"""
        end_idx = self.current_step + 1
        start_idx = max(0, end_idx - self.lookback_window)
        
        # Price data (OHLCV + volume)
        price_data = self.market_data[start_idx:end_idx].flatten()
        
        # Pad if needed
        if len(price_data) < self.lookback_window * 6:
            padding = np.zeros(self.lookback_window * 6 - len(price_data))
            price_data = np.concatenate([padding, price_data])
        
        # Portfolio features
        current_price = self.market_data[self.current_step][3]
        portfolio_features = np.array([
            self.balance / self.initial_balance,  # Normalized balance
            self.position,  # Current position
            self.position * current_price / self.initial_balance,  # Position value ratio
            self.total_profit / self.initial_balance  # Total profit ratio
        ], dtype=np.float32)
        
        return np.concatenate([price_data, portfolio_features]).astype(np.float32)

def load_market_data(data_path: str = "market_data.csv") -> np.ndarray:
    """Load and prepare market data"""
    try:
        if os.path.exists(data_path):
            df = pd.read_csv(data_path)
            # Expected columns: timestamp, open, high, low, close, volume
            return df[['open', 'high', 'low', 'close', 'volume', 'volume']].values
        else:
            # Generate synthetic data if no real data available
            logger.warning("No market data found, generating synthetic data")
            return generate_synthetic_market_data()
    except Exception as e:
        logger.error(f"Error loading market data: {e}")
        return generate_synthetic_market_data()

def generate_synthetic_market_data(days: int = 1000) -> np.ndarray:
    """Generate realistic synthetic market data"""
    np.random.seed(42)
    
    price = 50000.0  # Starting BTC price
    data = []
    
    for _ in range(days):
        # Generate daily OHLCV
        daily_return = np.random.normal(0.0005, 0.02)  # Slight positive bias, 2% daily vol
        
        open_price = price
        close_price = price * (1 + daily_return)
        
        high_price = max(open_price, close_price) * (1 + abs(np.random.normal(0, 0.01)))
        low_price = min(open_price, close_price) * (1 - abs(np.random.normal(0, 0.01)))
        
        volume = np.random.lognormal(15, 1)  # Realistic volume distribution
        
        data.append([open_price, high_price, low_price, close_price, volume, volume])
        price = close_price
    
    return np.array(data)

def train_baseline_ppo(env: gym.Env, 
                      model_name: str = "ppo_stevie",
                      total_timesteps: int = 1_000_000,
                      eval_episodes: int = 100) -> PPO:
    """Train baseline PPO model"""
    logger.info(f"Training PPO model with {total_timesteps:,} timesteps")
    
    # Create evaluation environment
    eval_env = Monitor(env)
    
    # Initialize PPO model with optimized hyperparameters
    model = PPO(
        "MlpPolicy", 
        env,
        learning_rate=0.0003,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        clip_range_vf=None,
        normalize_advantage=True,
        ent_coef=0.01,
        vf_coef=0.5,
        max_grad_norm=0.5,
        verbose=1,
        tensorboard_log="./tensorboard_logs/"
    )
    
    # Setup callbacks
    eval_callback = EvalCallback(
        eval_env, 
        best_model_save_path="./models/",
        log_path="./eval_logs/",
        eval_freq=10000,
        deterministic=True,
        render=False,
        n_eval_episodes=eval_episodes
    )
    
    # Train the model
    model.learn(
        total_timesteps=total_timesteps,
        callback=eval_callback,
        progress_bar=True
    )
    
    # Save final model
    model.save(f"./models/{model_name}")
    logger.info(f"Model saved as {model_name}")
    
    return model

def train_dqn_baseline(env: gym.Env,
                      model_name: str = "dqn_stevie",
                      total_timesteps: int = 500_000) -> DQN:
    """Train baseline DQN model"""
    logger.info(f"Training DQN model with {total_timesteps:,} timesteps")
    
    model = DQN(
        "MlpPolicy",
        env,
        learning_rate=0.0001,
        buffer_size=100000,
        learning_starts=50000,
        batch_size=32,
        tau=1.0,
        gamma=0.99,
        train_freq=4,
        gradient_steps=1,
        target_update_interval=10000,
        exploration_fraction=0.1,
        exploration_initial_eps=1.0,
        exploration_final_eps=0.05,
        max_grad_norm=10,
        verbose=1,
        tensorboard_log="./tensorboard_logs/"
    )
    
    model.learn(
        total_timesteps=total_timesteps,
        progress_bar=True
    )
    
    model.save(f"./models/{model_name}")
    logger.info(f"DQN model saved as {model_name}")
    
    return model

def evaluate_model(model, env: gym.Env, n_episodes: int = 100) -> Dict[str, float]:
    """Evaluate trained model"""
    logger.info(f"Evaluating model over {n_episodes} episodes")
    
    episode_rewards = []
    episode_profits = []
    win_rate = 0
    
    for episode in range(n_episodes):
        obs, _ = env.reset()
        done = False
        episode_reward = 0
        
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, done, _, info = env.step(action)
            episode_reward += reward
        
        episode_rewards.append(episode_reward)
        final_portfolio = info['portfolio_value']
        profit = (final_portfolio - env.initial_balance) / env.initial_balance
        episode_profits.append(profit)
        
        if profit > 0:
            win_rate += 1
    
    win_rate = win_rate / n_episodes
    
    metrics = {
        'mean_reward': np.mean(episode_rewards),
        'std_reward': np.std(episode_rewards),
        'mean_profit': np.mean(episode_profits),
        'std_profit': np.std(episode_profits),
        'win_rate': win_rate,
        'sharpe_ratio': np.mean(episode_profits) / np.std(episode_profits) if np.std(episode_profits) > 0 else 0
    }
    
    logger.info(f"Evaluation Results: {metrics}")
    return metrics

def main():
    """Main training pipeline"""
    logger.info("Starting Stevie RL Bootstrap Training")
    
    # Create necessary directories
    os.makedirs("models", exist_ok=True)
    os.makedirs("eval_logs", exist_ok=True)
    os.makedirs("tensorboard_logs", exist_ok=True)
    
    # Load market data
    market_data = load_market_data()
    logger.info(f"Loaded market data: {market_data.shape}")
    
    # Create environment
    env = StevieRLTradingEnv(market_data)
    
    # Train PPO model
    ppo_model = train_baseline_ppo(env, total_timesteps=1_000_000)
    ppo_metrics = evaluate_model(ppo_model, env)
    
    # Train DQN model  
    dqn_model = train_dqn_baseline(env, total_timesteps=500_000)
    dqn_metrics = evaluate_model(dqn_model, env)
    
    # Save training results
    results = {
        'ppo_metrics': ppo_metrics,
        'dqn_metrics': dqn_metrics,
        'market_data_shape': market_data.shape,
        'training_completed': True
    }
    
    with open('training_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info("Stevie RL Bootstrap training completed successfully!")
    
    # Return best model name for integration
    best_model = "ppo_stevie" if ppo_metrics['sharpe_ratio'] > dqn_metrics['sharpe_ratio'] else "dqn_stevie"
    print(f"Best model: {best_model}")
    return best_model

if __name__ == "__main__":
    main()