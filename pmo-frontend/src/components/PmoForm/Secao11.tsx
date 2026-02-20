// src/components/PmoForm/Secao11.tsx
// 🏗️ TEMPLATE CANÓNICO — Zero MUI, Tailwind + HTML nativo

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';

// Types
interface Secao11Data {
    controle_colheita_organicos?: { controle_colheita_organicos?: string };
    controle_colheita_nao_organicos?: { controle_colheita_nao_organicos?: string };
    [key: string]: any;
}

interface Secao11MUIProps {
    data: Secao11Data | null | undefined;
    onSectionChange: (data: Secao11Data) => void;
}

// =============================================================
// Accordion Reutilizável (Padrão Tailwind para Secções do PMO)
// =============================================================
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

// =============================================================
// Componente Principal
// =============================================================
const Secao11MUI: React.FC<Secao11MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    // Handler para os campos de texto aninhados
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        onSectionChange({
            ...safeData,
            [name]: { [name]: value }
        });
    };

    return (
        <SectionShell
            sectionLabel="Seção 11"
            title="Colheita"
        >
            <AccordionPanel
                title="11.1. Como é controlada a colheita dos produtos orgânicos?"
                defaultOpen
            >
                <textarea
                    name="controle_colheita_organicos"
                    value={safeData.controle_colheita_organicos?.controle_colheita_organicos || ''}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Descreva as formas de controle aqui..."
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel
                title="11.2. Nos casos de produção paralela, como é controlada a colheita dos produtos não orgânicos e como é feita a separação?"
            >
                <textarea
                    name="controle_colheita_nao_organicos"
                    value={safeData.controle_colheita_nao_organicos?.controle_colheita_nao_organicos || ''}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Descreva as formas de controle e separação aqui..."
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao11MUI;
