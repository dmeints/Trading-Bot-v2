import { createIntl, createIntlCache } from 'react-intl';

// Translation messages
export const messages = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.trading': 'Trading',
    'nav.portfolio': 'Portfolio',
    'nav.analytics': 'Analytics',
    'nav.plugins': 'Plugins',
    'nav.strategyBuilder': 'Strategy Builder',
    'nav.settings': 'Settings',
    
    // Dashboard
    'dashboard.title': 'Trading Dashboard',
    'dashboard.welcome': 'Welcome to Skippy',
    'dashboard.portfolioValue': 'Portfolio Value',
    'dashboard.todayChange': 'Today\'s Change',
    'dashboard.totalReturn': 'Total Return',
    
    // Trading
    'trading.buyOrder': 'Buy Order',
    'trading.sellOrder': 'Sell Order',
    'trading.orderPlaced': 'Order Placed Successfully',
    'trading.price': 'Price',
    'trading.quantity': 'Quantity',
    'trading.total': 'Total',
    
    // Layout Editor
    'layout.customize': 'Customize Layout',
    'layout.presets': 'Layout Presets',
    'layout.tradingFocus': 'Trading Focus',
    'layout.analyticsFocus': 'Analytics Focus',
    'layout.copilotFocus': 'AI Copilot Focus',
    'layout.save': 'Save Layout',
    'layout.reset': 'Reset to Default',
    
    // Accessibility
    'a11y.skipToContent': 'Skip to main content',
    'a11y.menuButton': 'Open menu',
    'a11y.closeDialog': 'Close dialog',
    'a11y.priceUpdate': 'Price updated',
    'a11y.newRecommendation': 'New AI recommendation available',
    
    // Settings
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.accessibility': 'Accessibility',
    'settings.notifications': 'Notifications',
    'settings.save': 'Save Settings',
  },
  es: {
    // Navigation
    'nav.dashboard': 'Panel de Control',
    'nav.trading': 'Trading',
    'nav.portfolio': 'Cartera',
    'nav.analytics': 'Análisis',
    'nav.plugins': 'Plugins',
    'nav.strategyBuilder': 'Constructor de Estrategias',
    'nav.settings': 'Configuración',
    
    // Dashboard
    'dashboard.title': 'Panel de Trading',
    'dashboard.welcome': 'Bienvenido a Skippy',
    'dashboard.portfolioValue': 'Valor de la Cartera',
    'dashboard.todayChange': 'Cambio de Hoy',
    'dashboard.totalReturn': 'Retorno Total',
    
    // Trading
    'trading.buyOrder': 'Orden de Compra',
    'trading.sellOrder': 'Orden de Venta',
    'trading.orderPlaced': 'Orden Realizada con Éxito',
    'trading.price': 'Precio',
    'trading.quantity': 'Cantidad',
    'trading.total': 'Total',
    
    // Layout Editor
    'layout.customize': 'Personalizar Diseño',
    'layout.presets': 'Diseños Predefinidos',
    'layout.tradingFocus': 'Enfoque Trading',
    'layout.analyticsFocus': 'Enfoque Análisis',
    'layout.copilotFocus': 'Enfoque IA Copiloto',
    'layout.save': 'Guardar Diseño',
    'layout.reset': 'Restablecer por Defecto',
    
    // Accessibility
    'a11y.skipToContent': 'Saltar al contenido principal',
    'a11y.menuButton': 'Abrir menú',
    'a11y.closeDialog': 'Cerrar diálogo',
    'a11y.priceUpdate': 'Precio actualizado',
    'a11y.newRecommendation': 'Nueva recomendación de IA disponible',
    
    // Settings
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.accessibility': 'Accesibilidad',
    'settings.notifications': 'Notificaciones',
    'settings.save': 'Guardar Configuración',
  }
};

// Create intl cache
const cache = createIntlCache();

// Create intl instances
export const createIntlInstance = (locale: string) => {
  return createIntl({
    locale,
    messages: messages[locale as keyof typeof messages] || messages.en
  }, cache);
};

// Default locale
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'es'];