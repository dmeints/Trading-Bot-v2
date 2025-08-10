
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, AlertTriangle, TrendingUp, Settings } from 'lucide-react';

interface RiskPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  config: {
    maxPositionSize: number; // % of portfolio
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
    leverageLimit: number;
    correlationLimit: number;
  };
  color: string;
}

const RISK_PRESETS: RiskPreset[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Low risk, steady returns',
    icon: <Shield className="w-4 h-4" />,
    config: {
      maxPositionSize: 5,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      maxDailyLoss: 1,
      leverageLimit: 1,
      correlationLimit: 0.3
    },
    color: 'bg-green-500'
  },
  {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced risk-reward',
    icon: <TrendingUp className="w-4 h-4" />,
    config: {
      maxPositionSize: 10,
      stopLossPercent: 3,
      takeProfitPercent: 6,
      maxDailyLoss: 2,
      leverageLimit: 2,
      correlationLimit: 0.5
    },
    color: 'bg-yellow-500'
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'High risk, high reward',
    icon: <AlertTriangle className="w-4 h-4" />,
    config: {
      maxPositionSize: 20,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      maxDailyLoss: 5,
      leverageLimit: 5,
      correlationLimit: 0.7
    },
    color: 'bg-red-500'
  }
];

interface RiskPresetsProps {
  currentPreset: string;
  customConfig?: any;
  onPresetChange: (preset: RiskPreset) => void;
  onCustomConfigChange: (config: any) => void;
}

export function RiskPresets({ 
  currentPreset, 
  customConfig, 
  onPresetChange, 
  onCustomConfigChange 
}: RiskPresetsProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customSettings, setCustomSettings] = useState(
    customConfig || RISK_PRESETS[1].config
  );

  const handlePresetSelect = (preset: RiskPreset) => {
    setIsCustomMode(false);
    onPresetChange(preset);
  };

  const handleCustomChange = (key: string, value: number) => {
    const newConfig = { ...customSettings, [key]: value };
    setCustomSettings(newConfig);
    onCustomConfigChange(newConfig);
  };

  const toggleCustomMode = () => {
    setIsCustomMode(!isCustomMode);
    if (!isCustomMode) {
      onCustomConfigChange(customSettings);
    }
  };

  const getRiskScore = (config: any) => {
    const riskFactors = [
      config.maxPositionSize / 20,
      config.stopLossPercent / 10,
      config.maxDailyLoss / 10,
      config.leverageLimit / 10,
      config.correlationLimit
    ];
    return riskFactors.reduce((sum, factor) => sum + factor, 0) / riskFactors.length;
  };

  const getRiskLevel = (score: number) => {
    if (score < 0.3) return { label: 'Low', color: 'text-green-600' };
    if (score < 0.6) return { label: 'Medium', color: 'text-yellow-600' };
    return { label: 'High', color: 'text-red-600' };
  };

  return (
    <TooltipProvider>
      <Card data-testid="risk-presets-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Risk Controls</span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCustomMode}
              data-testid="custom-risk-toggle"
            >
              <Settings className="w-3 h-3 mr-1" />
              {isCustomMode ? 'Presets' : 'Custom'}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isCustomMode ? (
            <>
              {/* Preset Selection */}
              <div className="grid grid-cols-1 gap-2">
                {RISK_PRESETS.map((preset) => {
                  const riskScore = getRiskScore(preset.config);
                  const riskLevel = getRiskLevel(riskScore);
                  
                  return (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={currentPreset === preset.id ? "default" : "outline"}
                          className={`p-3 h-auto justify-start ${
                            currentPreset === preset.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => handlePresetSelect(preset)}
                          data-testid={`risk-preset-${preset.id}`}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className={`p-1 rounded-full ${preset.color} text-white`}>
                              {preset.icon}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium">{preset.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {preset.description}
                              </div>
                            </div>
                            <Badge variant="outline" className={riskLevel.color}>
                              {riskLevel.label}
                            </Badge>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="space-y-1 text-xs">
                          <p><strong>Max Position:</strong> {preset.config.maxPositionSize}%</p>
                          <p><strong>Stop Loss:</strong> {preset.config.stopLossPercent}%</p>
                          <p><strong>Take Profit:</strong> {preset.config.takeProfitPercent}%</p>
                          <p><strong>Daily Loss Limit:</strong> {preset.config.maxDailyLoss}%</p>
                          <p><strong>Max Leverage:</strong> {preset.config.leverageLimit}x</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Current Settings Display */}
              {currentPreset && (
                <div className="p-3 bg-muted rounded-md" data-testid="current-risk-config">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Current Configuration
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Max Position: 
                      <span className="font-medium ml-1">
                        {RISK_PRESETS.find(p => p.id === currentPreset)?.config.maxPositionSize}%
                      </span>
                    </div>
                    <div>Stop Loss: 
                      <span className="font-medium ml-1">
                        {RISK_PRESETS.find(p => p.id === currentPreset)?.config.stopLossPercent}%
                      </span>
                    </div>
                    <div>Take Profit: 
                      <span className="font-medium ml-1">
                        {RISK_PRESETS.find(p => p.id === currentPreset)?.config.takeProfitPercent}%
                      </span>
                    </div>
                    <div>Daily Limit: 
                      <span className="font-medium ml-1">
                        {RISK_PRESETS.find(p => p.id === currentPreset)?.config.maxDailyLoss}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Custom Settings */}
              <div className="space-y-4" data-testid="custom-risk-controls">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Max Position Size: {customSettings.maxPositionSize}%
                  </label>
                  <Slider
                    value={[customSettings.maxPositionSize]}
                    onValueChange={([value]) => handleCustomChange('maxPositionSize', value)}
                    max={50}
                    min={1}
                    step={1}
                    className="mt-2"
                    data-testid="position-size-slider"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Stop Loss: {customSettings.stopLossPercent}%
                  </label>
                  <Slider
                    value={[customSettings.stopLossPercent]}
                    onValueChange={([value]) => handleCustomChange('stopLossPercent', value)}
                    max={20}
                    min={0.5}
                    step={0.5}
                    className="mt-2"
                    data-testid="stop-loss-slider"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Take Profit: {customSettings.takeProfitPercent}%
                  </label>
                  <Slider
                    value={[customSettings.takeProfitPercent]}
                    onValueChange={([value]) => handleCustomChange('takeProfitPercent', value)}
                    max={50}
                    min={1}
                    step={1}
                    className="mt-2"
                    data-testid="take-profit-slider"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Daily Loss Limit: {customSettings.maxDailyLoss}%
                  </label>
                  <Slider
                    value={[customSettings.maxDailyLoss]}
                    onValueChange={([value]) => handleCustomChange('maxDailyLoss', value)}
                    max={20}
                    min={0.5}
                    step={0.5}
                    className="mt-2"
                    data-testid="daily-loss-slider"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Max Leverage: {customSettings.leverageLimit}x
                  </label>
                  <Slider
                    value={[customSettings.leverageLimit]}
                    onValueChange={([value]) => handleCustomChange('leverageLimit', value)}
                    max={10}
                    min={1}
                    step={1}
                    className="mt-2"
                    data-testid="leverage-slider"
                  />
                </div>

                {/* Risk Assessment */}
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Risk Assessment
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          getRiskScore(customSettings) < 0.3 ? 'bg-green-500' :
                          getRiskScore(customSettings) < 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${getRiskScore(customSettings) * 100}%` }}
                        data-testid="risk-score-bar"
                      />
                    </div>
                    <span className={`text-xs font-medium ${getRiskLevel(getRiskScore(customSettings)).color}`}>
                      {getRiskLevel(getRiskScore(customSettings)).label}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
