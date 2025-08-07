import { IntlProvider as ReactIntlProvider } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { messages, DEFAULT_LOCALE } from '@/lib/i18n';

interface IntlProviderProps {
  children: React.ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  // Get user language preference
  const { data: preferences } = useQuery({
    queryKey: ['/api/preferences'],
  });

  const locale = (preferences as any)?.language || DEFAULT_LOCALE;

  return (
    <ReactIntlProvider
      locale={locale}
      messages={messages[locale as keyof typeof messages] || messages[DEFAULT_LOCALE]}
      defaultLocale={DEFAULT_LOCALE}
    >
      {children}
    </ReactIntlProvider>
  );
}