#!/usr/bin/env python3
"""
META-LABELING FILTER
Label if profit target hits before stop after a signal; train filter; gate low-quality entries
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report, roc_auc_score
import pickle
import json
from datetime import datetime

class MetaLabeler:
    def __init__(self, config: Optional[Dict] = None):
        """Initialize meta-labeling system"""
        self.config = config or {
            'profit_target_pct': 0.02,  # 2% profit target
            'stop_loss_pct': 0.01,      # 1% stop loss
            'max_holding_periods': 100,  # Max periods to hold
            'min_confidence': 0.6,       # Minimum confidence for entry
            'filter_threshold': 0.7      # Meta-label threshold
        }
        
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )
        
        self.is_trained = False
        self.performance_stats = {}
        
    def generate_meta_labels(self, 
                           prices: np.ndarray, 
                           signals: np.ndarray, 
                           signal_timestamps: np.ndarray) -> np.ndarray:
        """
        Generate meta-labels based on forward-looking price action
        
        Returns:
            meta_labels: 1 if profit target hit before stop, 0 otherwise
        """
        meta_labels = np.zeros(len(signals))
        
        for i, signal in enumerate(signals):
            if signal == 0:  # No signal
                continue
                
            signal_price = prices[i]
            signal_direction = 1 if signal > 0 else -1
            
            # Calculate target and stop prices
            if signal_direction == 1:  # Long signal
                target_price = signal_price * (1 + self.config['profit_target_pct'])
                stop_price = signal_price * (1 - self.config['stop_loss_pct'])
            else:  # Short signal
                target_price = signal_price * (1 - self.config['profit_target_pct'])
                stop_price = signal_price * (1 + self.config['stop_loss_pct'])
            
            # Look forward to see if target/stop is hit
            target_hit_first = self._check_target_vs_stop(
                prices[i+1:i+1+self.config['max_holding_periods']], 
                target_price, 
                stop_price, 
                signal_direction
            )
            
            meta_labels[i] = 1 if target_hit_first else 0
            
        return meta_labels
    
    def _check_target_vs_stop(self, 
                             future_prices: np.ndarray, 
                             target_price: float, 
                             stop_price: float, 
                             direction: int) -> bool:
        """Check if profit target is hit before stop loss"""
        for price in future_prices:
            if direction == 1:  # Long position
                if price >= target_price:
                    return True  # Target hit first
                elif price <= stop_price:
                    return False  # Stop hit first
            else:  # Short position
                if price <= target_price:
                    return True  # Target hit first
                elif price >= stop_price:
                    return False  # Stop hit first
        
        return False  # Neither target nor stop hit within time limit
    
    def prepare_features(self, 
                        market_data: Dict,
                        signal_strength: np.ndarray,
                        signal_confidence: np.ndarray) -> np.ndarray:
        """
        Prepare feature matrix for meta-labeling
        """
        features = []
        
        # Signal features
        features.append(signal_strength)
        features.append(signal_confidence)
        
        # Market regime features
        if 'rsi' in market_data:
            features.append(market_data['rsi'])
        if 'macd' in market_data:
            features.append(market_data['macd'])
        if 'volatility' in market_data:
            features.append(market_data['volatility'])
        if 'volume_ratio' in market_data:
            features.append(market_data['volume_ratio'])
        
        # Time-based features
        if 'hour_of_day' in market_data:
            features.append(market_data['hour_of_day'])
        if 'day_of_week' in market_data:
            features.append(market_data['day_of_week'])
        
        # Microstructure features
        if 'bid_ask_spread' in market_data:
            features.append(market_data['bid_ask_spread'])
        if 'order_imbalance' in market_data:
            features.append(market_data['order_imbalance'])
        
        return np.column_stack(features)
    
    def train_filter(self, 
                    features: np.ndarray, 
                    meta_labels: np.ndarray,
                    validation_split: float = 0.2) -> Dict:
        """
        Train meta-labeling filter
        """
        # Remove samples with no signal (where meta_label is meaningless)
        valid_indices = ~np.isnan(meta_labels)
        X = features[valid_indices]
        y = meta_labels[valid_indices]
        
        if len(X) == 0:
            raise ValueError("No valid samples for training")
        
        # Split data
        split_idx = int(len(X) * (1 - validation_split))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Train model
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        # Evaluate
        train_score = self.model.score(X_train, y_train)
        val_score = self.model.score(X_val, y_val)
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train, y_train, cv=5)
        
        # Predictions for detailed metrics
        y_pred = self.model.predict(X_val)
        y_pred_proba = self.model.predict_proba(X_val)[:, 1]
        
        # Store performance stats
        self.performance_stats = {
            'train_accuracy': train_score,
            'val_accuracy': val_score,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'auc_score': roc_auc_score(y_val, y_pred_proba) if len(np.unique(y_val)) > 1 else 0.5,
            'feature_importance': self.model.feature_importances_.tolist(),
            'training_samples': len(X_train),
            'validation_samples': len(X_val),
            'timestamp': datetime.now().isoformat()
        }
        
        return self.performance_stats
    
    def filter_signals(self, 
                      features: np.ndarray, 
                      signals: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Filter signals using trained meta-labeler
        
        Returns:
            filtered_signals: Original signals filtered by meta-labeler
            filter_probabilities: Probability scores from meta-labeler
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train_filter first.")
        
        # Get filter probabilities
        filter_probs = self.model.predict_proba(features)[:, 1]
        
        # Apply filter threshold
        filter_mask = filter_probs >= self.config['filter_threshold']
        
        # Apply filter to signals
        filtered_signals = signals.copy()
        filtered_signals[~filter_mask] = 0
        
        return filtered_signals, filter_probs
    
    def evaluate_filter_impact(self, 
                              original_signals: np.ndarray,
                              filtered_signals: np.ndarray,
                              prices: np.ndarray) -> Dict:
        """
        Evaluate the impact of meta-labeling filter
        """
        def calculate_returns(signals, prices):
            """Calculate returns from signals"""
            returns = []
            positions = np.zeros_like(prices)
            
            for i in range(len(signals)):
                if signals[i] != 0:
                    # Calculate return from signal to next period
                    if i < len(prices) - 1:
                        ret = (prices[i+1] - prices[i]) / prices[i]
                        if signals[i] < 0:  # Short signal
                            ret = -ret
                        returns.append(ret)
            
            return np.array(returns)
        
        # Calculate performance metrics
        original_returns = calculate_returns(original_signals, prices)
        filtered_returns = calculate_returns(filtered_signals, prices)
        
        original_stats = self._calculate_performance_stats(original_returns)
        filtered_stats = self._calculate_performance_stats(filtered_returns)
        
        # Filter effectiveness metrics
        signal_reduction = 1 - (np.sum(filtered_signals != 0) / max(np.sum(original_signals != 0), 1))
        
        return {
            'original_performance': original_stats,
            'filtered_performance': filtered_stats,
            'signal_reduction_pct': signal_reduction * 100,
            'sharpe_improvement': filtered_stats['sharpe_ratio'] - original_stats['sharpe_ratio'],
            'win_rate_improvement': filtered_stats['win_rate'] - original_stats['win_rate']
        }
    
    def _calculate_performance_stats(self, returns: np.ndarray) -> Dict:
        """Calculate trading performance statistics"""
        if len(returns) == 0:
            return {
                'total_return': 0,
                'sharpe_ratio': 0,
                'win_rate': 0,
                'max_drawdown': 0,
                'num_trades': 0
            }
        
        total_return = np.prod(1 + returns) - 1
        sharpe_ratio = np.mean(returns) / (np.std(returns) + 1e-8) * np.sqrt(252)
        win_rate = np.mean(returns > 0)
        
        # Calculate max drawdown
        cumulative = np.cumprod(1 + returns)
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = np.min(drawdown)
        
        return {
            'total_return': total_return,
            'sharpe_ratio': sharpe_ratio,
            'win_rate': win_rate,
            'max_drawdown': abs(max_drawdown),
            'num_trades': len(returns)
        }
    
    def save_model(self, filepath: str):
        """Save trained model to file"""
        model_data = {
            'model': self.model,
            'config': self.config,
            'performance_stats': self.performance_stats,
            'is_trained': self.is_trained
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
    
    def load_model(self, filepath: str):
        """Load trained model from file"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        
        self.model = model_data['model']
        self.config = model_data['config']
        self.performance_stats = model_data['performance_stats']
        self.is_trained = model_data['is_trained']
    
    def get_filter_stats(self) -> Dict:
        """Get filter performance statistics"""
        return {
            'is_trained': self.is_trained,
            'config': self.config,
            'performance': self.performance_stats
        }

# Example usage
if __name__ == "__main__":
    # Generate sample data
    np.random.seed(42)
    n_samples = 1000
    
    # Sample price series with trend
    prices = 100 * np.cumprod(1 + np.random.normal(0.0005, 0.02, n_samples))
    
    # Sample signals (random for example)
    signals = np.random.choice([-1, 0, 1], n_samples, p=[0.1, 0.8, 0.1])
    signal_timestamps = np.arange(n_samples)
    
    # Sample features
    features = np.random.randn(n_samples, 8)  # 8 features
    signal_strength = np.abs(np.random.randn(n_samples))
    signal_confidence = np.random.uniform(0, 1, n_samples)
    
    # Initialize meta-labeler
    meta_labeler = MetaLabeler()
    
    # Generate meta-labels
    meta_labels = meta_labeler.generate_meta_labels(prices, signals, signal_timestamps)
    
    # Prepare features
    feature_matrix = meta_labeler.prepare_features(
        {
            'rsi': np.random.uniform(20, 80, n_samples),
            'macd': np.random.normal(0, 0.001, n_samples),
            'volatility': np.random.uniform(0.01, 0.05, n_samples),
            'volume_ratio': np.random.uniform(0.5, 2.0, n_samples),
            'hour_of_day': np.random.randint(0, 24, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'bid_ask_spread': np.random.uniform(0.0001, 0.001, n_samples),
            'order_imbalance': np.random.normal(0, 0.1, n_samples)
        },
        signal_strength,
        signal_confidence
    )
    
    # Train filter
    stats = meta_labeler.train_filter(feature_matrix, meta_labels)
    print("Training Stats:", json.dumps(stats, indent=2))
    
    # Filter signals
    filtered_signals, filter_probs = meta_labeler.filter_signals(feature_matrix, signals)
    
    # Evaluate impact
    impact = meta_labeler.evaluate_filter_impact(signals, filtered_signals, prices)
    print("Filter Impact:", json.dumps(impact, indent=2))