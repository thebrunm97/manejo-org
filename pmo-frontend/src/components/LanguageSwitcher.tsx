import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation('common');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="flex items-center space-x-2 text-slate-600">
      <Globe className="w-4 h-4 text-slate-400" />
      <select
        value={i18n.resolvedLanguage}
        onChange={handleLanguageChange}
        className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer outline-none font-medium hover:text-emerald-600 transition-colors"
      >
        <option value="pt">{t('language.pt')}</option>
        <option value="en">{t('language.en')}</option>
        <option value="es">{t('language.es')}</option>
      </select>
    </div>
  );
};
