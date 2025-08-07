import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Minus,
  TrendingUp,
  MousePointer,
  Type,
  Square,
  Circle,
  Triangle
} from 'lucide-react';

type DrawingTool = 
  | 'select'
  | 'trendline'
  | 'horizontal'
  | 'vertical'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'fibonacci';

interface DrawingToolsProps {
  onToolSelect: (tool: DrawingTool) => void;
  selectedTool: DrawingTool;
}

export default function ChartDrawingTools({ onToolSelect, selectedTool }: DrawingToolsProps) {
  const tools = [
    { id: 'select' as DrawingTool, name: 'Select', icon: MousePointer, shortcut: 'S' },
    { id: 'trendline' as DrawingTool, name: 'Trend Line', icon: TrendingUp, shortcut: 'T' },
    { id: 'horizontal' as DrawingTool, name: 'Horizontal Line', icon: Minus, shortcut: 'H' },
    { id: 'vertical' as DrawingTool, name: 'Vertical Line', icon: Minus, shortcut: 'V' },
    { id: 'rectangle' as DrawingTool, name: 'Rectangle', icon: Square, shortcut: 'R' },
    { id: 'circle' as DrawingTool, name: 'Circle', icon: Circle, shortcut: 'C' },
    { id: 'text' as DrawingTool, name: 'Text Note', icon: Type, shortcut: 'A' },
    { id: 'fibonacci' as DrawingTool, name: 'Fibonacci', icon: Triangle, shortcut: 'F' },
  ];

  return (
    <Card className="bg-gray-800 border-gray-700 p-2">
      <div className="flex items-center space-x-1">
        <span className="text-xs text-gray-400 font-medium mr-2">Drawing:</span>
        
        {tools.slice(0, 3).map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onToolSelect(tool.id)}
              className={`p-2 ${
                selectedTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={`${tool.name} (${tool.shortcut})`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
        
        <Separator orientation="vertical" className="h-6 bg-gray-600" />
        
        {tools.slice(3, 6).map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onToolSelect(tool.id)}
              className={`p-2 ${
                selectedTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={`${tool.name} (${tool.shortcut})`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
        
        <Separator orientation="vertical" className="h-6 bg-gray-600" />
        
        {tools.slice(6).map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onToolSelect(tool.id)}
              className={`p-2 ${
                selectedTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={`${tool.name} (${tool.shortcut})`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
        
        <Separator orientation="vertical" className="h-6 bg-gray-600" />
        
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-700 text-xs px-2"
          title="Clear all drawings (Del)"
        >
          Clear
        </Button>
      </div>
    </Card>
  );
}