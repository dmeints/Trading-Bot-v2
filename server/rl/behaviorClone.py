#!/usr/bin/env python3
"""
Stevie Behavior Cloning - Imitation Learning from Expert Strategies
Pre-train models using heuristic expert demonstrations
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from typing import Tuple, List, Dict, Any
import logging
import json
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradingExpertHeuristic:
    """
    Expert trading heuristic using RSI/MA crossover rules
    Generates high-quality synthetic demonstrations
    """
    
    def __init__(self, 
                 rsi_period: int = 14,
                 rsi_oversold: float = 30,
                 rsi_overbought: float = 70,
                 ma_short: int = 10,
                 ma_long: int = 30):
        self.rsi_period = rsi_period
        self.rsi_oversold = rsi_oversold
        self.rsi_overbought = rsi_overbought
        self.ma_short = ma_short
        self.ma_long = ma_long
    
    def calculate_rsi(self, prices: np.ndarray) -> np.ndarray:
        """Calculate RSI indicator"""
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gains = pd.Series(gains).rolling(window=self.rsi_period).mean()
        avg_losses = pd.Series(losses).rolling(window=self.rsi_period).mean()
        
        rs = avg_gains / avg_losses
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50).values
    
    def calculate_moving_averages(self, prices: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Calculate short and long moving averages"""
        ma_short = pd.Series(prices).rolling(window=self.ma_short).mean().fillna(prices[0]).values
        ma_long = pd.Series(prices).rolling(window=self.ma_long).mean().fillna(prices[0]).values
        return ma_short, ma_long
    
    def generate_expert_actions(self, market_data: np.ndarray) -> List[Dict[str, Any]]:
        """Generate expert demonstrations from market data"""
        prices = market_data[:, 3]  # Close prices
        rsi = self.calculate_rsi(prices)
        ma_short, ma_long = self.calculate_moving_averages(prices)
        
        demonstrations = []
        position = 0  # 0 = no position, 1 = long position
        
        for i in range(max(self.ma_long, self.rsi_period), len(market_data)):
            current_price = prices[i]
            current_rsi = rsi[i]
            current_ma_short = ma_short[i]
            current_ma_long = ma_long[i]
            
            # Expert decision logic
            action = 0  # Default: Hold
            
            # Buy signal: RSI oversold + MA crossover bullish
            if (position == 0 and 
                current_rsi < self.rsi_oversold and 
                current_ma_short > current_ma_long and
                ma_short[i-1] <= ma_long[i-1]):  # Crossover
                action = 1  # Buy
                position = 1
            
            # Sell signal: RSI overbought OR MA crossover bearish
            elif (position == 1 and 
                  (current_rsi > self.rsi_overbought or 
                   (current_ma_short < current_ma_long and ma_short[i-1] >= ma_long[i-1]))):
                action = 2  # Sell
                position = 0
            
            # Create state representation
            state = self._create_state(market_data, i, position)
            
            demonstrations.append({
                'state': state,
                'action': action,
                'step': i,
                'rsi': current_rsi,
                'ma_signal': 1 if current_ma_short > current_ma_long else 0,
                'position': position
            })
        
        logger.info(f"Generated {len(demonstrations)} expert demonstrations")
        return demonstrations
    
    def _create_state(self, market_data: np.ndarray, step: int, position: int, lookback: int = 20) -> np.ndarray:
        """Create state representation matching RL environment"""
        start_idx = max(0, step - lookback + 1)
        end_idx = step + 1
        
        # Price features (OHLCV)
        price_data = market_data[start_idx:end_idx, :5].flatten()
        
        # Pad if needed
        if len(price_data) < lookback * 5:
            padding = np.zeros(lookback * 5 - len(price_data))
            price_data = np.concatenate([padding, price_data])
        
        # Portfolio features (simplified)
        portfolio_features = np.array([
            1.0,  # Normalized balance (assume constant for expert)
            float(position),  # Current position
            0.0,  # Position value (simplified)
            0.0   # Total profit (simplified)
        ])
        
        return np.concatenate([price_data, portfolio_features]).astype(np.float32)

class ExpertDataset(Dataset):
    """PyTorch dataset for expert demonstrations"""
    
    def __init__(self, demonstrations: List[Dict[str, Any]]):
        self.states = []
        self.actions = []
        
        for demo in demonstrations:
            self.states.append(demo['state'])
            self.actions.append(demo['action'])
        
        self.states = np.array(self.states)
        self.actions = np.array(self.actions)
        
        # Normalize states
        self.scaler = StandardScaler()
        self.states = self.scaler.fit_transform(self.states)
    
    def __len__(self):
        return len(self.states)
    
    def __getitem__(self, idx):
        return torch.FloatTensor(self.states[idx]), torch.LongTensor([self.actions[idx]])

class BehaviorCloningNetwork(nn.Module):
    """Neural network for behavior cloning"""
    
    def __init__(self, state_dim: int, action_dim: int, hidden_dims: List[int] = [256, 128, 64]):
        super().__init__()
        
        layers = []
        prev_dim = state_dim
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.2)
            ])
            prev_dim = hidden_dim
        
        layers.append(nn.Linear(prev_dim, action_dim))
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)

class BehaviorCloningTrainer:
    """Trainer for behavior cloning"""
    
    def __init__(self, 
                 state_dim: int,
                 action_dim: int = 3,
                 hidden_dims: List[int] = [256, 128, 64],
                 learning_rate: float = 0.001):
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = BehaviorCloningNetwork(state_dim, action_dim, hidden_dims).to(self.device)
        self.optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        self.criterion = nn.CrossEntropyLoss()
        
        logger.info(f"Behavior cloning model initialized on {self.device}")
    
    def train(self, 
              train_loader: DataLoader, 
              val_loader: DataLoader,
              epochs: int = 100,
              patience: int = 10) -> Dict[str, List[float]]:
        """Train behavior cloning model"""
        
        train_losses = []
        val_losses = []
        val_accuracies = []
        best_val_loss = float('inf')
        patience_counter = 0
        
        logger.info(f"Starting behavior cloning training for {epochs} epochs")
        
        for epoch in range(epochs):
            # Training phase
            self.model.train()
            train_loss = 0.0
            
            for batch_states, batch_actions in train_loader:
                batch_states = batch_states.to(self.device)
                batch_actions = batch_actions.squeeze().to(self.device)
                
                self.optimizer.zero_grad()
                outputs = self.model(batch_states)
                loss = self.criterion(outputs, batch_actions)
                loss.backward()
                self.optimizer.step()
                
                train_loss += loss.item()
            
            train_loss /= len(train_loader)
            train_losses.append(train_loss)
            
            # Validation phase
            val_loss, val_acc = self._validate(val_loader)
            val_losses.append(val_loss)
            val_accuracies.append(val_acc)
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                torch.save(self.model.state_dict(), 'best_bc_model.pth')
            else:
                patience_counter += 1
            
            if epoch % 10 == 0:
                logger.info(f"Epoch {epoch}: Train Loss={train_loss:.4f}, Val Loss={val_loss:.4f}, Val Acc={val_acc:.4f}")
            
            if patience_counter >= patience:
                logger.info(f"Early stopping at epoch {epoch}")
                break
        
        # Load best model
        self.model.load_state_dict(torch.load('best_bc_model.pth'))
        
        return {
            'train_losses': train_losses,
            'val_losses': val_losses,
            'val_accuracies': val_accuracies
        }
    
    def _validate(self, val_loader: DataLoader) -> Tuple[float, float]:
        """Validate model"""
        self.model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch_states, batch_actions in val_loader:
                batch_states = batch_states.to(self.device)
                batch_actions = batch_actions.squeeze().to(self.device)
                
                outputs = self.model(batch_states)
                loss = self.criterion(outputs, batch_actions)
                val_loss += loss.item()
                
                _, predicted = torch.max(outputs.data, 1)
                total += batch_actions.size(0)
                correct += (predicted == batch_actions).sum().item()
        
        val_loss /= len(val_loader)
        accuracy = correct / total
        
        return val_loss, accuracy
    
    def save_model(self, path: str):
        """Save trained model"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'model_architecture': {
                'state_dim': self.model.network[0].in_features,
                'action_dim': self.model.network[-1].out_features
            }
        }, path)
        logger.info(f"Model saved to {path}")
    
    def predict(self, state: np.ndarray) -> int:
        """Predict action for given state"""
        self.model.eval()
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            outputs = self.model(state_tensor)
            _, predicted = torch.max(outputs, 1)
            return predicted.item()

def load_market_data(data_path: str = "market_data.csv") -> np.ndarray:
    """Load market data for behavior cloning"""
    try:
        if os.path.exists(data_path):
            df = pd.read_csv(data_path)
            return df[['open', 'high', 'low', 'close', 'volume']].values
        else:
            # Generate synthetic data
            return generate_synthetic_data()
    except Exception as e:
        logger.error(f"Error loading market data: {e}")
        return generate_synthetic_data()

def generate_synthetic_data(days: int = 2000) -> np.ndarray:
    """Generate synthetic market data for training"""
    np.random.seed(42)
    
    price = 50000.0
    data = []
    
    for _ in range(days):
        daily_return = np.random.normal(0.0005, 0.02)
        
        open_price = price
        close_price = price * (1 + daily_return)
        
        high_price = max(open_price, close_price) * (1 + abs(np.random.normal(0, 0.01)))
        low_price = min(open_price, close_price) * (1 - abs(np.random.normal(0, 0.01)))
        
        volume = np.random.lognormal(15, 1)
        
        data.append([open_price, high_price, low_price, close_price, volume])
        price = close_price
    
    return np.array(data)

def main():
    """Main behavior cloning pipeline"""
    logger.info("Starting Stevie Behavior Cloning Training")
    
    # Create directories
    os.makedirs("models", exist_ok=True)
    
    # Load market data
    market_data = load_market_data()
    logger.info(f"Loaded market data: {market_data.shape}")
    
    # Generate expert demonstrations
    expert = TradingExpertHeuristic()
    demonstrations = expert.generate_expert_actions(market_data)
    
    # Create dataset
    dataset = ExpertDataset(demonstrations)
    
    # Split dataset
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    # Initialize trainer
    state_dim = dataset.states.shape[1]
    trainer = BehaviorCloningTrainer(state_dim)
    
    # Train model
    training_history = trainer.train(train_loader, val_loader, epochs=100)
    
    # Save model
    trainer.save_model("models/behavior_cloning_model.pth")
    
    # Save training results
    results = {
        'training_history': training_history,
        'expert_demonstrations': len(demonstrations),
        'final_val_accuracy': training_history['val_accuracies'][-1],
        'state_dimension': state_dim
    }
    
    with open('bc_training_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info("Behavior cloning training completed successfully!")
    logger.info(f"Final validation accuracy: {training_history['val_accuracies'][-1]:.4f}")
    
    return trainer

if __name__ == "__main__":
    main()