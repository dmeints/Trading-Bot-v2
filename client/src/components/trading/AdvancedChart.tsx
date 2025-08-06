import { useEffect, useRef } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { Card } from '@/components/ui/card';

export default function AdvancedChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedSymbol } = useTradingStore();
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: selectedSymbol?.replace('/', '') || 'BTCUSD',
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com'
    });

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [selectedSymbol]);

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full">
      <div className="tradingview-widget-container h-full">
        <div ref={containerRef} className="tradingview-widget-container__widget h-full"></div>
        <div className="tradingview-widget-copyright">
          <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
            <span className="blue-text">Track all markets on TradingView</span>
          </a>
        </div>
      </div>
    </Card>
  );
}