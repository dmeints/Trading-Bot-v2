import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  TrendingUp,
  BarChart3,
  Bot,
  Eye,
  Settings
} from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  icon: React.ReactNode;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Skippy',
    description: 'Your AI-powered trading platform. Let\'s take a quick tour of the key features.',
    target: 'body',
    position: 'top',
    icon: <TrendingUp className="w-5 h-5" />
  },
  {
    id: 'chart',
    title: 'Trading Chart',
    description: 'Real-time price charts with technical indicators. Click timeframes (1H/4H/1D/1W) to change periods.',
    target: '[data-testid="trading-chart"]',
    position: 'bottom',
    icon: <BarChart3 className="w-5 h-5" />
  },
  {
    id: 'watchlist',
    title: 'Watchlist & Alerts',
    description: 'Track your favorite symbols, set price alerts, and monitor real-time market data.',
    target: '[data-tour="watchlist-panel"]',
    position: 'right',
    icon: <Eye className="w-5 h-5" />
  },
  {
    id: 'trade-panel',
    title: 'Quick Trade Panel',
    description: 'Execute trades with balance presets (25%/50%/75%/MAX) and fine-grain slider for precise amounts.',
    target: '[data-testid="quick-trade-panel"]',
    position: 'left',
    icon: <TrendingUp className="w-5 h-5" />
  },
  {
    id: 'ai-recommendations',
    title: 'AI Trading Assistant',
    description: 'Get intelligent market insights, trade recommendations, and risk assessments powered by AI.',
    target: '[data-testid="ai-recommendations"]',
    position: 'left',
    icon: <Bot className="w-5 h-5" />
  },
  {
    id: 'layout-presets',
    title: 'Layout Presets',
    description: 'Switch between professional layouts: Classic Trading, Analytics-First, AI Copilot, or create your own.',
    target: '[data-testid="layout-presets"]',
    position: 'bottom',
    icon: <Settings className="w-5 h-5" />
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const updateTooltipPosition = () => {
      const step = tourSteps[currentStep];
      const targetElement = document.querySelector(step.target);
      
      if (targetElement && step.target !== 'body') {
        const rect = targetElement.getBoundingClientRect();
        let top = 0;
        let left = 0;

        switch (step.position) {
          case 'top':
            top = rect.top - 120;
            left = rect.left + rect.width / 2 - 200;
            break;
          case 'bottom':
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2 - 200;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - 60;
            left = rect.left - 420;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - 60;
            left = rect.right + 20;
            break;
        }

        // Keep tooltip within viewport
        top = Math.max(20, Math.min(top, window.innerHeight - 140));
        left = Math.max(20, Math.min(left, window.innerWidth - 420));

        setTooltipPosition({ top, left });
      } else {
        // Center of screen for welcome step
        setTooltipPosition({
          top: window.innerHeight / 2 - 120,
          left: window.innerWidth / 2 - 200
        });
      }
    };

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    
    return () => window.removeEventListener('resize', updateTooltipPosition);
  }, [currentStep, isOpen]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    onClose();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />
      
      {/* Tooltip */}
      <Card
        className="absolute w-96 bg-gray-900 border-gray-700 p-6 shadow-2xl"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              {step.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {currentStep + 1} of {tourSteps.length}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed mb-6">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={skipTour}
            className="text-gray-400 border-gray-600 hover:bg-gray-700 hover:text-white"
          >
            Skip Tour
          </Button>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={prevStep}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={nextStep}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
              {currentStep < tourSteps.length - 1 && (
                <ArrowRight className="w-4 h-4 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex space-x-1 mt-4">
          {tourSteps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded ${
                index <= currentStep ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}