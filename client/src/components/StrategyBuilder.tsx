import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Play, Save, Plus, Trash2, Settings, Code } from 'lucide-react';

interface StrategyNode {
  id: string;
  type: 'signal_source' | 'filter' | 'position_sizer' | 'exit_rule';
  label: string;
  parameters: Record<string, any>;
  position: { x: number; y: number };
}

interface StrategyConnection {
  id: string;
  source: string;
  target: string;
}

interface StrategyConfig {
  name: string;
  description: string;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
  metadata: {
    created: string;
    version: string;
    author: string;
  };
}

const NODE_TYPES = {
  signal_source: {
    label: 'Signal Source',
    color: 'bg-blue-100 border-blue-500 text-blue-800',
    options: [
      { value: 'price', label: 'Price Action', params: { symbol: 'BTC', timeframe: '1h' } },
      { value: 'ema', label: 'EMA Crossover', params: { fast: 12, slow: 26 } },
      { value: 'rsi', label: 'RSI', params: { period: 14, overbought: 70, oversold: 30 } },
      { value: 'macd', label: 'MACD', params: { fast: 12, slow: 26, signal: 9 } }
    ]
  },
  filter: {
    label: 'Filter',
    color: 'bg-green-100 border-green-500 text-green-800',
    options: [
      { value: 'threshold', label: 'Threshold', params: { operator: '>', value: 0 } },
      { value: 'regime', label: 'Market Regime', params: { type: 'trending', strength: 0.5 } },
      { value: 'volume', label: 'Volume Filter', params: { min_volume: 1000 } },
      { value: 'time', label: 'Time Filter', params: { start: '09:00', end: '16:00' } }
    ]
  },
  position_sizer: {
    label: 'Position Sizer',
    color: 'bg-yellow-100 border-yellow-500 text-yellow-800',
    options: [
      { value: 'fixed', label: 'Fixed Size', params: { size: 100 } },
      { value: 'percent', label: 'Percent of Equity', params: { percent: 5 } },
      { value: 'kelly', label: 'Kelly Criterion', params: { win_rate: 0.6, avg_win: 1.5, avg_loss: 1.0 } },
      { value: 'volatility', label: 'Volatility Based', params: { target_vol: 0.02, lookback: 20 } }
    ]
  },
  exit_rule: {
    label: 'Exit Rule',
    color: 'bg-red-100 border-red-500 text-red-800',
    options: [
      { value: 'profit_target', label: 'Profit Target', params: { target: 5 } },
      { value: 'stop_loss', label: 'Stop Loss', params: { stop: 2 } },
      { value: 'trailing_stop', label: 'Trailing Stop', params: { trail: 1.5 } },
      { value: 'time_exit', label: 'Time Exit', params: { bars: 10 } }
    ]
  }
};

export function StrategyBuilder() {
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<StrategyConfig>({
    name: 'New Strategy',
    description: 'Custom trading strategy',
    nodes: [],
    connections: [],
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      author: 'Skippy User'
    }
  });
  
  const [selectedNodeType, setSelectedNodeType] = useState<string>('signal_source');
  const [selectedNode, setSelectedNode] = useState<StrategyNode | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const addNode = useCallback((type: keyof typeof NODE_TYPES, subtype: string) => {
    const nodeType = NODE_TYPES[type];
    const option = nodeType.options.find(opt => opt.value === subtype);
    if (!option) return;

    const newNode: StrategyNode = {
      id: `${type}_${Date.now()}`,
      type,
      label: option.label,
      parameters: { ...option.params, subtype },
      position: { 
        x: Math.random() * 400 + 50, 
        y: Math.random() * 300 + 50 
      }
    };

    setStrategy(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setStrategy(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      connections: prev.connections.filter(
        conn => conn.source !== nodeId && conn.target !== nodeId
      )
    }));
    setSelectedNode(null);
  }, []);

  const updateNodeParameters = useCallback((nodeId: string, parameters: Record<string, any>) => {
    setStrategy(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId ? { ...node, parameters: { ...node.parameters, ...parameters } } : node
      )
    }));
  }, []);

  const exportStrategy = useCallback(async () => {
    if (strategy.nodes.length === 0) {
      toast({
        title: "Export Failed",
        description: "Strategy must have at least one node",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Generate TypeScript strategy code
      const strategyCode = generateStrategyCode(strategy);
      
      // Create downloadable file
      const blob = new Blob([strategyCode], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${strategy.name.toLowerCase().replace(/\s+/g, '-')}.ts`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Strategy Exported",
        description: `Downloaded ${strategy.name}.ts successfully`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  }, [strategy, toast]);

  const saveStrategy = useCallback(async () => {
    try {
      // Save strategy configuration to localStorage for now
      // In a real implementation, this would save to the server
      const savedStrategies = JSON.parse(localStorage.getItem('skippy_strategies') || '[]');
      const updatedStrategies = [...savedStrategies, { ...strategy, id: Date.now().toString() }];
      localStorage.setItem('skippy_strategies', JSON.stringify(updatedStrategies));

      toast({
        title: "Strategy Saved",
        description: `Strategy "${strategy.name}" saved successfully`
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save strategy",
        variant: "destructive"
      });
    }
  }, [strategy, toast]);

  const generateStrategyCode = (config: StrategyConfig): string => {
    return `// Generated Strategy: ${config.name}
// Description: ${config.description}
// Generated on: ${new Date().toISOString()}

import { Strategy, StrategyContext, StrategyResult } from '../types/strategy';

export class ${config.name.replace(/\s+/g, '')}Strategy implements Strategy {
  name = '${config.name}';
  description = '${config.description}';
  parameters = ${JSON.stringify(config.nodes.reduce((acc, node) => ({ ...acc, [node.id]: node.parameters }), {}), null, 2)};

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const { marketData, indicators, portfolio, timestamp } = context;
    const signals = [];

    try {
      // Generated logic based on nodes
      ${config.nodes.map(node => generateNodeCode(node)).join('\n      ')}

      return {
        signals,
        metadata: {
          strategy: '${config.name}',
          timestamp: timestamp.toISOString(),
          nodeCount: ${config.nodes.length}
        }
      };
    } catch (error) {
      console.error('Strategy execution error:', error);
      return { signals: [] };
    }
  }
}

export default ${config.name.replace(/\s+/g, '')}Strategy;`;
  };

  const generateNodeCode = (node: StrategyNode): string => {
    switch (node.type) {
      case 'signal_source':
        return `// ${node.label} Signal Source
      if (marketData.length > 0) {
        const signal = this.generate${node.parameters.subtype}Signal(marketData, ${JSON.stringify(node.parameters)});
        if (signal) signals.push(signal);
      }`;
      case 'filter':
        return `// ${node.label} Filter
      signals = signals.filter(signal => this.apply${node.parameters.subtype}Filter(signal, ${JSON.stringify(node.parameters)}));`;
      case 'position_sizer':
        return `// ${node.label} Position Sizer
      signals.forEach(signal => {
        signal.size = this.calculate${node.parameters.subtype}Size(portfolio, ${JSON.stringify(node.parameters)});
      });`;
      case 'exit_rule':
        return `// ${node.label} Exit Rule
      this.apply${node.parameters.subtype}Exit(signals, ${JSON.stringify(node.parameters)});`;
      default:
        return `// Unknown node type: ${node.type}`;
    }
  };

  return (
    <div className="space-y-6" data-testid="strategy-builder">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Strategy Builder
          </CardTitle>
          <CardDescription>
            Build custom trading strategies using drag-and-drop components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Strategy Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="strategy-name">Strategy Name</Label>
                <Input
                  id="strategy-name"
                  value={strategy.name}
                  onChange={(e) => setStrategy(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="strategy-name-input"
                />
              </div>
              <div>
                <Label htmlFor="strategy-description">Description</Label>
                <Textarea
                  id="strategy-description"
                  value={strategy.description}
                  onChange={(e) => setStrategy(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  data-testid="strategy-description-input"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveStrategy} variant="outline" size="sm" data-testid="save-strategy">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button 
                  onClick={exportStrategy} 
                  disabled={isExporting}
                  size="sm"
                  data-testid="export-strategy-button"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </div>

            {/* Node Palette */}
            <div className="space-y-4">
              <h3 className="font-medium">Components</h3>
              <div className="space-y-2">
                {Object.entries(NODE_TYPES).map(([type, config]) => (
                  <div key={type}>
                    <Label className="text-sm font-medium">{config.label}</Label>
                    <div className="space-y-1 mt-1">
                      {config.options.map((option) => (
                        <Button
                          key={option.value}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => addNode(type as keyof typeof NODE_TYPES, option.value)}
                          data-testid={`add-${type}-${option.value}`}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="lg:col-span-2">
              <div className="relative">
                <h3 className="font-medium mb-2">Strategy Canvas</h3>
                <div 
                  ref={canvasRef}
                  className="border-2 border-dashed border-muted rounded-lg h-96 p-4 bg-muted/10 relative overflow-hidden"
                  data-testid="strategy-canvas"
                >
                  {strategy.nodes.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Code className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Add components to build your strategy</p>
                      </div>
                    </div>
                  ) : (
                    strategy.nodes.map((node) => (
                      <div
                        key={node.id}
                        className={`absolute p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          NODE_TYPES[node.type].color
                        } ${selectedNode?.id === node.id ? 'ring-2 ring-primary' : ''}`}
                        style={{ 
                          left: node.position.x, 
                          top: node.position.y,
                          maxWidth: '150px'
                        }}
                        onClick={() => setSelectedNode(node)}
                        data-testid={`strategy-node-${node.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate">{node.label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNode(node.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-xs opacity-75">
                          {Object.entries(node.parameters).slice(0, 2).map(([key, value]) => (
                            <div key={key}>{key}: {String(value)}</div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Node Details Panel */}
                {selectedNode && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {selectedNode.label} Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-3">
                        {Object.entries(selectedNode.parameters).map(([key, value]) => (
                          <div key={key}>
                            <Label htmlFor={`param-${key}`} className="text-xs">
                              {key.replace(/_/g, ' ').toUpperCase()}
                            </Label>
                            <Input
                              id={`param-${key}`}
                              value={String(value)}
                              onChange={(e) => {
                                const newValue = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                                updateNodeParameters(selectedNode.id, { [key]: newValue });
                              }}
                              className="text-xs"
                              data-testid={`param-input-${key}`}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Strategy Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{strategy.nodes.length} Components</Badge>
            <Badge variant="outline">
              {strategy.nodes.filter(n => n.type === 'signal_source').length} Signal Sources
            </Badge>
            <Badge variant="outline">
              {strategy.nodes.filter(n => n.type === 'filter').length} Filters
            </Badge>
            <Badge variant="outline">
              {strategy.nodes.filter(n => n.type === 'position_sizer').length} Position Sizers
            </Badge>
            <Badge variant="outline">
              {strategy.nodes.filter(n => n.type === 'exit_rule').length} Exit Rules
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}