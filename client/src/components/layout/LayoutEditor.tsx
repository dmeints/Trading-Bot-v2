import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout, Grid, Save, RotateCcw, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useIntl } from 'react-intl';

interface LayoutPanel {
  id: string;
  title: string;
  component: string;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
}

interface LayoutConfig {
  id?: string;
  name: string;
  panels: LayoutPanel[];
  gridColumns: number;
  preset?: string;
}

const DEFAULT_PANELS: LayoutPanel[] = [
  { id: 'trading-chart', title: 'Trading Chart', component: 'TradingChart', visible: true, size: 'large', position: { x: 0, y: 0 } },
  { id: 'order-book', title: 'Order Book', component: 'OrderBook', visible: true, size: 'medium', position: { x: 1, y: 0 } },
  { id: 'portfolio-summary', title: 'Portfolio', component: 'PortfolioSummary', visible: true, size: 'medium', position: { x: 0, y: 1 } },
  { id: 'ai-insights', title: 'AI Insights', component: 'AIInsights', visible: true, size: 'medium', position: { x: 1, y: 1 } },
  { id: 'recent-trades', title: 'Recent Trades', component: 'RecentTrades', visible: true, size: 'small', position: { x: 0, y: 2 } },
  { id: 'market-data', title: 'Market Data', component: 'MarketData', visible: true, size: 'small', position: { x: 1, y: 2 } },
];

const LAYOUT_PRESETS = {
  'trading-focus': {
    name: 'Trading Focus',
    panels: DEFAULT_PANELS.map(panel => ({
      ...panel,
      visible: panel.id === 'trading-chart' || panel.id === 'order-book' || panel.id === 'recent-trades',
      size: (panel.id === 'trading-chart' ? 'large' : 'medium') as LayoutPanel['size']
    })),
    gridColumns: 2
  },
  'analytics-focus': {
    name: 'Analytics Focus',
    panels: DEFAULT_PANELS.map(panel => ({
      ...panel,
      visible: panel.id === 'trading-chart' || panel.id === 'portfolio-summary' || panel.id === 'market-data',
      size: (panel.id === 'trading-chart' ? 'large' : 'medium') as LayoutPanel['size']
    })),
    gridColumns: 2
  },
  'copilot-focus': {
    name: 'AI Copilot Focus',
    panels: DEFAULT_PANELS.map(panel => ({
      ...panel,
      visible: panel.id === 'ai-insights' || panel.id === 'trading-chart' || panel.id === 'portfolio-summary',
      size: (panel.id === 'ai-insights' ? 'large' : 'medium') as LayoutPanel['size']
    })),
    gridColumns: 2
  }
};

function SortablePanel({ panel, onToggle, onSizeChange }: {
  panel: LayoutPanel;
  onToggle: (id: string) => void;
  onSizeChange: (id: string, size: LayoutPanel['size']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: panel.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-4 bg-gray-800 border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-white">{panel.title}</span>
          <div className="flex items-center space-x-2">
            <Select value={panel.size} onValueChange={(size) => onSizeChange(panel.id, size as LayoutPanel['size'])}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">S</SelectItem>
                <SelectItem value="medium">M</SelectItem>
                <SelectItem value="large">L</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={panel.visible ? "default" : "secondary"}
              size="sm"
              onClick={() => onToggle(panel.id)}
              className="h-8 w-16"
            >
              {panel.visible ? 'Show' : 'Hide'}
            </Button>
          </div>
        </div>
        <div className={`bg-gray-700 rounded h-${panel.size === 'small' ? '16' : panel.size === 'medium' ? '24' : '32'} flex items-center justify-center text-gray-400`}>
          {panel.component}
        </div>
      </Card>
    </div>
  );
}

interface LayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LayoutEditor({ isOpen, onClose }: LayoutEditorProps) {
  const intl = useIntl();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentLayout, setCurrentLayout] = useState<LayoutConfig>({
    name: 'Custom Layout',
    panels: DEFAULT_PANELS,
    gridColumns: 2
  });
  const [layoutName, setLayoutName] = useState('');

  // Fetch user layouts
  const { data: userLayouts } = useQuery({
    queryKey: ['/api/layouts'],
    enabled: isOpen
  });

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (layout: LayoutConfig) => {
      return await apiRequest('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
      toast({
        title: "Layout Saved",
        description: "Your custom layout has been saved successfully."
      });
    }
  });

  // Apply preset mutation
  const applyPresetMutation = useMutation({
    mutationFn: async (preset: string) => {
      return await apiRequest('/api/layouts/apply-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
      toast({
        title: "Preset Applied",
        description: "Layout preset has been applied successfully."
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setCurrentLayout(prev => ({
        ...prev,
        panels: arrayMove(
          prev.panels,
          prev.panels.findIndex(panel => panel.id === active.id),
          prev.panels.findIndex(panel => panel.id === over!.id)
        )
      }));
    }
  };

  const handleTogglePanel = (id: string) => {
    setCurrentLayout(prev => ({
      ...prev,
      panels: prev.panels.map(panel =>
        panel.id === id ? { ...panel, visible: !panel.visible } : panel
      )
    }));
  };

  const handleSizeChange = (id: string, size: LayoutPanel['size']) => {
    setCurrentLayout(prev => ({
      ...prev,
      panels: prev.panels.map(panel =>
        panel.id === id ? { ...panel, size } : panel
      )
    }));
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = LAYOUT_PRESETS[presetKey as keyof typeof LAYOUT_PRESETS];
    if (preset) {
      setCurrentLayout({
        name: preset.name,
        panels: preset.panels,
        gridColumns: preset.gridColumns,
        preset: presetKey
      });
      applyPresetMutation.mutate(presetKey);
    }
  };

  const handleSaveLayout = () => {
    if (!layoutName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your layout.",
        variant: "destructive"
      });
      return;
    }

    saveLayoutMutation.mutate({
      ...currentLayout,
      name: layoutName
    });
  };

  const handleResetToDefault = () => {
    setCurrentLayout({
      name: 'Default Layout',
      panels: DEFAULT_PANELS,
      gridColumns: 2
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Layout className="w-5 h-5" />
            <span>{intl.formatMessage({ id: 'layout.customize' })}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Layout Presets */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {intl.formatMessage({ id: 'layout.presets' })}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LAYOUT_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  variant="outline"
                  onClick={() => handleApplyPreset(key)}
                  className="h-auto p-3 flex flex-col items-center space-y-1"
                  disabled={applyPresetMutation.isPending}
                >
                  <Grid className="w-4 h-4" />
                  <span className="text-xs">{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Panel Configuration */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Panel Configuration</Label>
            <DndContext onDragEnd={handleDragEnd}>
              <SortableContext items={currentLayout.panels.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {currentLayout.panels.map(panel => (
                    <SortablePanel
                      key={panel.id}
                      panel={panel}
                      onToggle={handleTogglePanel}
                      onSizeChange={handleSizeChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Save Layout */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="layout-name" className="text-sm font-medium mb-2 block">
                Layout Name
              </Label>
              <Input
                id="layout-name"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Enter layout name..."
                className="bg-gray-800 border-gray-600"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleResetToDefault}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {intl.formatMessage({ id: 'layout.reset' })}
              </Button>
              
              <Button 
                onClick={handleSaveLayout}
                disabled={saveLayoutMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {intl.formatMessage({ id: 'layout.save' })}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}