import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Zap, BarChart3, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Skippy</h1>
              <p className="text-sm text-blue-300">AI Trading Assistant</p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
            data-testid="button-login"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-white mb-6">
            AI-Powered Crypto Trading
            <span className="text-blue-400"> Made Simple</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Experience the future of cryptocurrency trading with Skippy's advanced multi-agent AI system. 
            Get real-time market analysis, intelligent trade recommendations, and comprehensive risk management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/api/login'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              data-testid="button-start-trading"
            >
              Start Trading with AI
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white px-8 py-3 text-lg"
              data-testid="button-learn-more"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold text-white mb-4">Powered by Multi-Agent AI</h3>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Five specialized AI agents work together to analyze markets, assess risks, and execute trades with precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <CardTitle className="text-white">Market Analysis</CardTitle>
              <CardDescription className="text-gray-400">
                Advanced technical analysis with real-time pattern recognition and trend identification.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <CardTitle className="text-white">Risk Management</CardTitle>
              <CardDescription className="text-gray-400">
                Intelligent position sizing and portfolio risk assessment to protect your capital.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <CardTitle className="text-white">Smart Execution</CardTitle>
              <CardDescription className="text-gray-400">
                Automated trade execution with optimal timing and price improvement strategies.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-orange-400" />
              </div>
              <CardTitle className="text-white">Performance Tracking</CardTitle>
              <CardDescription className="text-gray-400">
                Comprehensive analytics with P&L tracking, win rates, and performance metrics.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-red-400" />
              </div>
              <CardTitle className="text-white">Sentiment Analysis</CardTitle>
              <CardDescription className="text-gray-400">
                Real-time sentiment monitoring from news, social media, and market indicators.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white">AI Recommendations</CardTitle>
              <CardDescription className="text-gray-400">
                Intelligent trade suggestions with confidence scores and detailed reasoning.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="bg-gray-800/30 rounded-2xl p-12 backdrop-blur-sm border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-400 mb-2" data-testid="text-ai-accuracy">94%</div>
              <div className="text-gray-300">AI Prediction Accuracy</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-400 mb-2" data-testid="text-trades-executed">10M+</div>
              <div className="text-gray-300">Trades Executed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-400 mb-2" data-testid="text-assets-managed">$500M+</div>
              <div className="text-gray-300">Assets Under Management</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-white mb-6">Ready to Transform Your Trading?</h3>
          <p className="text-gray-300 text-lg mb-8">
            Join thousands of traders who are already using AI to maximize their profits and minimize risks.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/api/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 text-lg"
            data-testid="button-get-started-cta"
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-gray-800">
        <div className="text-center text-gray-400">
          <p>&copy; 2024 Skippy AI Trading Assistant. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
