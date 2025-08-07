import { useEffect, useRef } from 'react';

interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  clear?: boolean;
}

export function LiveRegion({ message, politeness = 'polite', clear = true }: LiveRegionProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveRegionRef.current && message) {
      liveRegionRef.current.textContent = message;
      
      if (clear) {
        const timer = setTimeout(() => {
          if (liveRegionRef.current) {
            liveRegionRef.current.textContent = '';
          }
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [message, clear]);

  return (
    <div
      ref={liveRegionRef}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
    />
  );
}

// Hook for managing live region announcements
export function useLiveRegion() {
  const announceRef = useRef<(message: string, politeness?: 'polite' | 'assertive') => void>();

  const announce = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current(message, politeness);
    }
  };

  const LiveRegionComponent = ({ onAnnounce }: { onAnnounce: typeof announce }) => {
    announceRef.current = onAnnounce;
    return null;
  };

  return { announce, LiveRegionComponent };
}