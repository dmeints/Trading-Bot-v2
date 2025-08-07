import { useIntl } from 'react-intl';

export function SkipLink() {
  const intl = useIntl();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      data-testid="skip-link"
    >
      {intl.formatMessage({ id: 'a11y.skipToContent' })}
    </a>
  );
}