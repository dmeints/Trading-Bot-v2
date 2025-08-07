#!/usr/bin/env python3

"""
PHASE 2: BEHAVIOR CLONING PRETRAINING
Expert demonstration generation via RSI/MA heuristics and policy pretraining
"""

import numpy as np
import pandas as pd
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

class TradingExpert:
    """Expert trader using RSI/MA heuristics for behavior cloning"""
    
    def __init__(self, rsi_period: int = 14, ma_short: int = 10, ma_long: int = 30):
        self.rsi_period = rsi_period
        self.ma_short = ma_short
        self.ma_long = ma_long
        self.scaler = StandardScaler()
        
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
    
    def calculate_ma(self, prices: np.ndarray, period: int) -> np.ndarray:
        """Calculate moving average"""
        return pd.Series(prices).rolling(window=period).mean().fillna(method='bfill').values
    
    def generate_expert_action(self, state: Dict) -> int:
        """Generate expert action based on heuristics
        Returns: 0=hold, 1=buy, 2=sell
        """
        price = state['price']
        rsi = state['rsi']
        ma_short = state['ma_short']
        ma_long = state['ma_long'] 
        position = state.get('position', 0)
        sentiment = state.get('sentiment', 0)
        volatility = state.get('volatility', 0)
        
        # Expert heuristic rules
        
        # Strong buy signals
        if (rsi < 30 and ma_short > ma_long and sentiment > 0.2 and 
            position == 0 and volatility < 50):
            return 1  # Buy
        
        # Strong sell signals  
        if (rsi > 70 or sentiment < -0.3 or
            (position > 0 and ma_short < ma_long)):
            return 2  # Sell
            
        # Additional buy conditions
        if (rsi < 40 and ma_short > ma_long * 1.02 and position == 0 and
            sentiment > 0):
            return 1  # Buy
            
        # Risk management sells
        if position > 0:
            # Take profit if RSI > 65
            if rsi > 65:
                return 2  # Sell
                
            # Stop loss on negative sentiment
            if sentiment < -0.2:
                return 2  # Sell
        
        return 0  # Hold

    def generate_expert_demonstrations(self, data_path: str, num_episodes: int = 1000) -> List[Dict]:
        """Generate expert demonstrations from historical data"""
        
        demonstrations = []
        
        # Load historical data (assuming CSV format)
        symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT']
        
        for symbol in symbols:
            try:
                # Load price data
                price_file = os.path.join(data_path, 'ohlcv', f'{symbol}_ohlcv.csv')
                if not os.path.exists(price_file):
                    print(f"Warning: {price_file} not found")
                    continue
                    
                df = pd.read_csv(price_file)
                prices = df['close'].values
                volumes = df['volume'].values
                
                # Load additional features
                sentiment_file = os.path.join(data_path, 'sentiment', f'{symbol}_sentiment.csv')
                onchain_file = os.path.join(data_path, 'onchain', f'{symbol}_onchain.csv')
                
                sentiment_data = {}
                if os.path.exists(sentiment_file):
                    sent_df = pd.read_csv(sentiment_file)
                    for _, row in sent_df.iterrows():
                        sentiment_data[row['timestamp']] = row['sentiment']
                
                # Calculate technical indicators
                rsi = self.calculate_rsi(prices)
                ma_short = self.calculate_ma(prices, self.ma_short)
                ma_long = self.calculate_ma(prices, self.ma_long)
                
                # Calculate volatility
                returns = np.diff(np.log(prices))
                volatility = pd.Series(returns).rolling(window=24).std().fillna(0) * 100
                
                # Generate episode demonstrations
                episode_length = min(len(prices) // num_episodes, 100)
                
                for episode in range(min(num_episodes, len(prices) // episode_length)):
                    start_idx = episode * episode_length
                    end_idx = min(start_idx + episode_length, len(prices))
                    
                    episode_demo = {
                        'symbol': symbol,
                        'episode': episode,
                        'states': [],
                        'actions': [],
                        'rewards': []
                    }
                    
                    position = 0
                    entry_price = 0
                    
                    for i in range(start_idx + max(self.rsi_period, self.ma_long), end_idx):
                        # Build state
                        timestamp = df.iloc[i]['timestamp'] if 'timestamp' in df.columns else i
                        
                        state = {
                            'price': prices[i],
                            'rsi': rsi[i],
                            'ma_short': ma_short[i], 
                            'ma_long': ma_long[i],
                            'position': position,
                            'sentiment': sentiment_data.get(timestamp, 0),
                            'volatility': volatility.iloc[i] if i < len(volatility) else 0,
                            'volume_ratio': volumes[i] / np.mean(volumes[max(0, i-24):i+1]) if i > 24 else 1,
                            'price_change_24h': (prices[i] - prices[max(0, i-24)]) / prices[max(0, i-24)] * 100 if i > 24 else 0
                        }
                        
                        # Get expert action
                        action = self.generate_expert_action(state)
                        
                        # Calculate reward based on next price move
                        if i < end_idx - 1:
                            next_price = prices[i + 1]
                            
                            if action == 1 and position == 0:  # Buy
                                position = 1
                                entry_price = prices[i]
                                reward = 0  # Initial reward
                            elif action == 2 and position == 1:  # Sell
                                reward = (prices[i] - entry_price) / entry_price
                                position = 0
                                entry_price = 0
                            else:  # Hold
                                if position == 1:
                                    reward = (next_price - prices[i]) / prices[i]
                                else:
                                    reward = 0
                        else:
                            reward = 0
                        
                        # Store demonstration
                        episode_demo['states'].append(state)
                        episode_demo['actions'].append(action)
                        episode_demo['rewards'].append(reward)
                    
                    if len(episode_demo['states']) > 10:  # Only keep meaningful episodes
                        demonstrations.append(episode_demo)
                        
                print(f"Generated {len([d for d in demonstrations if d['symbol'] == symbol])} demonstrations for {symbol}")
                        
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
                
        print(f"Total demonstrations generated: {len(demonstrations)}")
        return demonstrations

class BehaviorCloningTrainer:
    """Neural network trainer for behavior cloning"""
    
    def __init__(self, state_dim: int = 9, action_dim: int = 3, hidden_dim: int = 128):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.hidden_dim = hidden_dim
        self.model = self.build_model()
        self.scaler = StandardScaler()
        
    def build_model(self) -> tf.keras.Model:
        """Build neural network for behavior cloning"""
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(self.hidden_dim, activation='relu', input_shape=(self.state_dim,)),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(self.hidden_dim, activation='relu'),
            tf.keras.layers.Dropout(0.3), 
            tf.keras.layers.Dense(self.hidden_dim // 2, activation='relu'),
            tf.keras.layers.Dense(self.action_dim, activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def prepare_training_data(self, demonstrations: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """Convert demonstrations to training data"""
        states = []
        actions = []
        
        for demo in demonstrations:
            for state, action in zip(demo['states'], demo['actions']):
                # Convert state dict to feature vector
                features = [
                    state['price'] / 1000,  # Normalize price
                    state['rsi'] / 100,
                    state['ma_short'] / 1000,
                    state['ma_long'] / 1000,  
                    state['position'],
                    state['sentiment'],
                    state['volatility'] / 100,
                    state['volume_ratio'],
                    state['price_change_24h'] / 100
                ]
                
                states.append(features)
                actions.append(action)
        
        X = np.array(states)
        y = tf.keras.utils.to_categorical(actions, num_classes=self.action_dim)
        
        # Normalize features
        X = self.scaler.fit_transform(X)
        
        return X, y
    
    def train(self, demonstrations: List[Dict], epochs: int = 100, validation_split: float = 0.2):
        """Train behavior cloning model"""
        print("Preparing training data...")
        X, y = self.prepare_training_data(demonstrations)
        
        print(f"Training on {len(X)} samples...")
        print(f"Action distribution: {np.bincount(np.argmax(y, axis=1))}")
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=validation_split, random_state=42)
        
        # Callbacks
        callbacks = [
            tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
            tf.keras.callbacks.ModelCheckpoint('models/behavior_cloning_model.h5', save_best_only=True)
        ]
        
        # Train model
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=32,
            validation_data=(X_val, y_val),
            callbacks=callbacks,
            verbose=1
        )
        
        # Evaluate
        val_loss, val_acc = self.model.evaluate(X_val, y_val, verbose=0)
        print(f"Final validation accuracy: {val_acc:.3f}")
        
        return history
    
    def save_model(self, path: str = 'models/behavior_cloning_model.h5'):
        """Save trained model"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.model.save(path)
        
        # Save scaler
        import joblib
        joblib.dump(self.scaler, 'models/behavior_cloning_scaler.pkl')
        
        print(f"Model saved to {path}")

def main():
    """Main behavior cloning training pipeline"""
    print("🎯 Starting Behavior Cloning Training...")
    
    # Initialize expert and trainer
    expert = TradingExpert()
    trainer = BehaviorCloningTrainer()
    
    # Generate expert demonstrations
    data_path = './data/historical'
    if not os.path.exists(data_path):
        print(f"Error: Data directory {data_path} not found. Run loadAllData.ts first.")
        return
    
    print("Generating expert demonstrations...")
    demonstrations = expert.generate_expert_demonstrations(data_path, num_episodes=500)
    
    if not demonstrations:
        print("No demonstrations generated. Check data files.")
        return
    
    # Save demonstrations for analysis
    os.makedirs('models', exist_ok=True)
    with open('models/expert_demonstrations.json', 'w') as f:
        # Convert numpy arrays to lists for JSON serialization
        demo_json = []
        for demo in demonstrations:
            demo_copy = demo.copy()
            demo_copy['states'] = [
                {k: float(v) if isinstance(v, (np.floating, np.integer)) else v 
                 for k, v in state.items()} 
                for state in demo['states']
            ]
            demo_json.append(demo_copy)
        json.dump(demo_json, f, indent=2)
    
    # Train behavior cloning model
    print("Training behavior cloning model...")
    history = trainer.train(demonstrations, epochs=50)
    
    # Save model
    trainer.save_model()
    
    # Generate training report
    report = {
        'timestamp': datetime.now().isoformat(),
        'num_demonstrations': len(demonstrations),
        'total_samples': sum(len(demo['states']) for demo in demonstrations),
        'symbols': list(set(demo['symbol'] for demo in demonstrations)),
        'final_accuracy': float(history.history['val_accuracy'][-1]),
        'final_loss': float(history.history['val_loss'][-1])
    }
    
    with open('models/behavior_cloning_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("✅ Behavior cloning training completed!")
    print(f"Final accuracy: {report['final_accuracy']:.3f}")
    print(f"Training samples: {report['total_samples']}")

if __name__ == '__main__':
    main()