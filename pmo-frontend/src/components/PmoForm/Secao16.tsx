// src/components/PmoForm/Secao16.tsx
// Clonado do Template Canónico (Secao11) — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';

// Types
interface Secao16Data {
    formas_reclamacoes_criticas?: { formas_reclamacoes_criticas?: string };
    tratamento_reclamacoes_criticas?: { tratamento_reclamacoes_criticas?: string };
    [key: string]: any;
}

interface Secao16MUIProps {
    data: Secao16Data | null | undefined;
    onSectionChange: (data: Secao16Data) => void;
}

// Accordion Reutilizável
interface AccordionPanelProps {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

const AccordionPanel: React.FC<AccordionPanelProps> = ({ title, defaultOpen = false, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 
                           hover:bg-gray-100 transition-colors duration-150 text-left cursor-pointer"
            >
                <span className="font-semibold text-sm text-gray-800 leading-snug pr-4">
                    {title}
                </span>
                <ChevronDown
                    size={18}
                    className={`shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="px-4 py-4">
                    {children}
                </div>
            )}
        </div>
    );
};

const Secao16MUI: React.FC<Secao16MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: { [name]: value } });
    };

    return (
        <SectionShell sectionLabel="Seção 16" title="SAC (Serviço de Atendimento ao Consumidor)">
            <AccordionPanel
                title="16.1. Quais são as formas dos consumidores fazerem reclamações ou críticas aos produtos?"
                defaultOpen
            >
                <textarea
                    name="formas_reclamacoes_criticas"
                    value={safeData.formas_reclamacoes_criticas?.formas_reclamacoes_criticas || ''}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Descreva as formas de contato aqui..."
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel
                title="16.2. Como são tratadas possíveis reclamações ou críticas recebidas dos consumidores?"
            >
                <textarea
                    name="tratamento_reclamacoes_criticas"
                    value={safeData.tratamento_reclamacoes_criticas?.tratamento_reclamacoes_criticas || ''}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Descreva o procedimento de tratamento aqui..."
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao16MUI;
