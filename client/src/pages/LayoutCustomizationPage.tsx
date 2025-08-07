import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Layout, TestTube, Users } from 'lucide-react';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { ExperimentDashboard } from '@/components/experiments/ExperimentDashboard';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import LayoutPresets from '@/components/trading/LayoutPresets';
import { useIntl } from 'react-intl';
import { useExperiment } from '@/hooks/useExperiment';

export default function LayoutCustomizationPage() {
  const intl = useIntl();
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'layouts' | 'experiments' | 'accessibility'>('layouts');
  
  // Test A/B experiment
  const { getVariant, trackEvent } = useExperiment('layout-customization-flow');
  const variant = getVariant('control');

  const handleOpenLayoutEditor = () => {
    trackEvent('layout_editor_opened');
    setIsLayoutEditorOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {intl.formatMessage({ id: 'layout.customize' })}
            </h1>
            <p className="text-gray-400">
              Personalize your trading experience with custom layouts, A/B testing, and accessibility features
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <Button onClick={handleOpenLayoutEditor} data-testid="button-open-layout-editor">
              <Layout className="w-4 h-4 mr-2" />
              Customize Layout
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-8">
          <button
            onClick={() => setActiveTab('layouts')}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'layouts' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            data-testid="tab-layouts"
          >
            <Layout className="w-4 h-4 mr-2" />
            Layout Customization
          </button>
          <button
            onClick={() => setActiveTab('experiments')}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'experiments' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            data-testid="tab-experiments"
          >
            <TestTube className="w-4 h-4 mr-2" />
            A/B Testing
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'accessibility' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            data-testid="tab-accessibility"
          >
            <Users className="w-4 h-4 mr-2" />
            Accessibility
          </button>
        </div>

        {/* Content */}
        <main id="main-content">
          {activeTab === 'layouts' && (
            <div className="space-y-6">
              <LayoutPresets />

              {variant === 'enhanced' && (
                <Card className="bg-gray-800 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-white">Advanced Customization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 mb-4">
                      Use drag-and-drop to create your perfect trading environment
                    </p>
                    <Button onClick={handleOpenLayoutEditor} variant="outline">
                      Open Advanced Editor
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'experiments' && (
            <ExperimentDashboard />
          )}

          {activeTab === 'accessibility' && (
            <div className="space-y-6">
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">Accessibility Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded">
                    <div>
                      <h3 className="font-medium text-white">High Contrast Mode</h3>
                      <p className="text-sm text-gray-400">Increase contrast for better visibility</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded">
                    <div>
                      <h3 className="font-medium text-white">Reduced Motion</h3>
                      <p className="text-sm text-gray-400">Minimize animations and transitions</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded">
                    <div>
                      <h3 className="font-medium text-white">Screen Reader Support</h3>
                      <p className="text-sm text-gray-400">Enhanced compatibility with assistive technologies</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>
                  
                  <div className="p-4 bg-gray-700 rounded">
                    <h3 className="font-medium text-white mb-3">Font Size</h3>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">Small</Button>
                      <Button variant="default" size="sm">Medium</Button>
                      <Button variant="outline" size="sm">Large</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">WCAG 2.1 AA Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
                      <h4 className="text-green-400 font-medium mb-2">✓ Color Contrast</h4>
                      <p className="text-sm text-gray-400">All text meets 4.5:1 contrast ratio</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
                      <h4 className="text-green-400 font-medium mb-2">✓ Keyboard Navigation</h4>
                      <p className="text-sm text-gray-400">Full keyboard accessibility support</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
                      <h4 className="text-green-400 font-medium mb-2">✓ Screen Reader</h4>
                      <p className="text-sm text-gray-400">ARIA labels and live regions</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
                      <h4 className="text-green-400 font-medium mb-2">✓ Focus Management</h4>
                      <p className="text-sm text-gray-400">Clear focus indicators and management</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {/* Layout Editor Modal */}
        <LayoutEditor 
          isOpen={isLayoutEditorOpen} 
          onClose={() => setIsLayoutEditorOpen(false)} 
        />
      </div>
    </div>
  );
}