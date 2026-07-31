import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import estático dos catálogos (Fase 1 do Piloto)
import commonPt from './locales/pt/common.json';
import authPt from './locales/pt/auth.json';
import dashboardPt from './locales/pt/dashboard.json';

import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import dashboardEn from './locales/en/dashboard.json';

import commonEs from './locales/es/common.json';
import authEs from './locales/es/auth.json';
import dashboardEs from './locales/es/dashboard.json';

const resources = {
  pt: {
    common: commonPt,
    auth: authPt,
    dashboard: dashboardPt,
  },
  en: {
    common: commonEn,
    auth: authEn,
    dashboard: dashboardEn,
  },
  es: {
    common: commonEs,
    auth: authEs,
    dashboard: dashboardEs,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['pt', 'en', 'es'],
    fallbackLng: 'pt',
    defaultNS: 'common',
    
    // Atualiza a tag <html> lang attribute automaticamente
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },

    interpolation: {
      escapeValue: false, // React já escapa XSS
    },

    // Para a Fase 1 (imports estáticos), desabilitamos Suspense
    react: {
      useSuspense: false,
    },
  });

// Atualiza o atributo document lang quando a linguagem muda
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
