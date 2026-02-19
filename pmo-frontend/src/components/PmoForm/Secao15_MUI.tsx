// src/components/PmoForm/Secao15_MUI.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup_MUI';

// Types
interface Secao15Data {
    registros_rastreabilidade?: { registros_rastreabilidade?: string };
    frequencia_registros_anotacoes?: string;
    frequencia_registros_anotacoes_outros?: string;
    [key: string]: any;
}

interface Secao15MUIProps {
    data: Secao15Data | null | undefined;
    onSectionChange: (data: Secao15Data) => void;
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
                <span className="font-semibold text-sm text-gray-800 leading-snug pr-4">{title}</span>
                <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-4 py-4">{children}</div>}
        </div>
    );
};

const Secao15MUI: React.FC<Secao15MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'registros_rastreabilidade') {
            onSectionChange({ ...safeData, [name]: { [name]: value } });
        } else {
            onSectionChange({ ...safeData, [name]: value });
        }
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => {
        onSectionChange({ ...safeData, [fieldName]: newValue });
    };

    return (
        <SectionShell sectionLabel="Seção 15" title="Rastreabilidade (Documentos/Registros)">
            <AccordionPanel
                title="15.1. Que tipo de registros são adotados para comprovar a rastreabilidade?"
                defaultOpen
            >
                <p className="text-sm text-gray-500 mb-2">Inclua produção, armazenamento, processamento, aquisições e vendas.</p>
                <textarea
                    name="registros_rastreabilidade"
                    value={safeData.registros_rastreabilidade?.registros_rastreabilidade || ''}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel title="15.2. Com que frequência realiza os registros/anotações?">
                <CheckboxGroupMUI
                    title=""
                    options={['Diário', 'Semanal', 'Quinzenal', 'Mensal', 'Outro(s) - Qual(is)?']}
                    selectedString={safeData.frequencia_registros_anotacoes}
                    onSelectionChange={(newValue) => handleCheckboxChange('frequencia_registros_anotacoes', newValue)}
                    otherOption="Outro(s) - Qual(is)?"
                    otherValue={safeData.frequencia_registros_anotacoes_outros}
                    onOtherChange={handleChange as any}
                    otherName="frequencia_registros_anotacoes_outros"
                    otherPlaceholder="Especifique a outra frequência..."
                />
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao15MUI;
