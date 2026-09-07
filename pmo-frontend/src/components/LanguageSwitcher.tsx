import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '../utils/cn';

interface LanguageSwitcherProps {
  /** Classes do contexto: a cor do texto vem daqui. */
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className }) => {
  const { t, i18n } = useTranslation('common');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    // Sem cor própria: herda a do contexto. Fixar slate-600 aqui tornava o
    // seletor ilegível dentro do menu lateral, que é verde escuro.
    <div className={cn('flex items-center gap-2', className)}>
      <Globe className="w-4 h-4 opacity-70" />
      <select
        value={i18n.resolvedLanguage}
        onChange={handleLanguageChange}
        aria-label={t('language.label', 'Idioma')}
        className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer outline-none font-medium text-inherit"
      >
        {/* As opções são desenhadas pelo sistema operacional, que usa o próprio
            contraste: por isso levam cor escura explícita, e não herdada. */}
        <option value="pt" className="text-slate-900">{t('language.pt')}</option>
        <option value="en" className="text-slate-900">{t('language.en')}</option>
        <option value="es" className="text-slate-900">{t('language.es')}</option>
      </select>
    </div>
  );
};
