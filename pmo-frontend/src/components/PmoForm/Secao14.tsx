// src/components/PmoForm/Secao14.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';

// Types
interface CanalConfig {
    label: string;
    name?: string;
    placeholder?: string;
}

interface CanalCheckboxProps {
    label: string;
    name?: string;
    checked: boolean;
    onChange: (value: string, isChecked: boolean) => void;
    conditionalValue?: string;
    onTextChange: (e: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}

interface Secao14Data {
    canais_comercializacao?: string;
    canais_atacadistas_quais?: string;
    canais_feiras_quais?: string;
    canais_cooperativas_quais?: string;
    canais_outros_quais?: string;
    [key: string]: any;
}

interface Secao14MUIProps {
    data: Secao14Data | null | undefined;
    onSectionChange: (data: Secao14Data) => void;
}

// Sub-componente: Canal Checkbox com campo condicional
const CanalCheckbox: React.FC<CanalCheckboxProps> = ({ label, name, checked, onChange, conditionalValue, onTextChange, placeholder }) => {
    return (
        <div>
            <label className="flex items-start gap-2.5 py-1.5 cursor-pointer group">
                <input
                    type="checkbox"
                    value={label}
                    checked={checked}
                    onChange={(e) => onChange(e.target.value, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 select-none">
                    {label}
                </span>
            </label>
            {checked && placeholder && (
                <input
                    type="text"
                    name={name}
                    placeholder={placeholder}
                    value={conditionalValue || ''}
                    onChange={onTextChange}
                    className="w-full ml-6 mt-1 mb-2 rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400"
                />
            )}
        </div>
    );
};

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

const Secao14MUI: React.FC<Secao14MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const canaisSelecionados = String(safeData.canais_comercializacao || '').split('; ').filter(Boolean);

    const handleCheckboxChange = (value: string, isChecked: boolean) => {
        let novasOpcoes = [...canaisSelecionados];
        if (isChecked && !novasOpcoes.includes(value)) {
            novasOpcoes.push(value);
        } else {
            novasOpcoes = novasOpcoes.filter(opt => opt !== value);
        }
        onSectionChange({ ...safeData, canais_comercializacao: novasOpcoes.join('; ') });
    };

    const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: value });
    };

    const canais: CanalConfig[] = [
        { label: 'Na unidade de produção.' },
        { label: 'Programa de Aquisição de Alimentos (PAA).' },
        { label: 'Programa Nacional de Alimentação Escolar (PNAE).' },
        { label: 'Em estabelecimentos atacadistas e varejistas – Quais:', name: 'canais_atacadistas_quais', placeholder: 'Especifique os estabelecimentos...' },
        { label: 'Em feiras – Quais:', name: 'canais_feiras_quais', placeholder: 'Especifique as feiras...' },
        { label: 'Em cooperativas e associações – Quais:', name: 'canais_cooperativas_quais', placeholder: 'Especifique as cooperativas/associações...' },
        { label: 'Em outros canais – Quais:', name: 'canais_outros_quais', placeholder: 'Especifique outros canais...' }
    ];

    return (
        <SectionShell sectionLabel="Seção 14" title="Comercialização">
            <AccordionPanel
                title="14.1. Em quais canais os produtos são comercializados?"
                defaultOpen
            >
                <fieldset className="space-y-0.5 mt-1">
                    {canais.map(canal => (
                        <CanalCheckbox
                            key={canal.label}
                            label={canal.label}
                            name={canal.name}
                            checked={canaisSelecionados.includes(canal.label)}
                            onChange={handleCheckboxChange}
                            conditionalValue={canal.name ? safeData[canal.name] : ''}
                            onTextChange={handleTextChange}
                            placeholder={canal.placeholder}
                        />
                    ))}
                </fieldset>
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao14MUI;
