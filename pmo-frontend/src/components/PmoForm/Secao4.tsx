// src/components/PmoForm/Secao4.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

// Types
interface Secao4Data {
    ha_animais_servico_subsistencia_companhia?: {
        ha_animais_servico_subsistencia_companhia?: boolean;
    };
    animais_servico?: {
        lista_animais_servico?: any[];
    };
    animais_subsistencia_companhia_ornamentais?: {
        lista_animais_subsistencia?: any[];
    };
    [key: string]: any;
}

interface Secao4MUIProps {
    data: Secao4Data | null | undefined;
    onSectionChange: (data: Secao4Data) => void;
}

interface TabelaAnimaisSubsistenciaProps {
    itens: any[];
    onItensChange: (itens: any[]) => void;
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

// Sub-componente pass-through para TabelaDinamica
const TabelaAnimaisSubsistencia: React.FC<TabelaAnimaisSubsistenciaProps> = ({ itens, onItensChange }) => {
    const colunas: TableColumn[] = [
        { id: 'tipo', label: 'Tipo', type: 'select', options: ['Subsistência', 'Companhia', 'Ornamental', 'Outro'] },
        { id: 'especie', label: 'Espécie', type: 'text' },
        { id: 'quantidade', label: 'Quantidade', type: 'number' },
        { id: 'insumos', label: 'Insumos', type: 'text' },
        { id: 'tratamento_dejetos', label: 'Tratamento dos Dejetos', type: 'text' },
        { id: 'circulacao_area_organica', label: 'Circulação na Área Orgânica', type: 'text' },
    ];

    return (
        <TabelaDinamica
            columns={colunas}
            data={itens}
            onDataChange={onItensChange}
            itemName="Animal de Subsistência/Outro"
            itemNoun="o"
        />
    );
};

const Secao4MUI: React.FC<Secao4MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const temAnimais = safeData.ha_animais_servico_subsistencia_companhia?.ha_animais_servico_subsistencia_companhia === true;

    const handleSimNaoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const valor = e.target.value === 'true';
        if (!valor) {
            onSectionChange({
                ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: false },
                animais_servico: { lista_animais_servico: [] },
                animais_subsistencia_companhia_ornamentais: { lista_animais_subsistencia: [] }
            });
        } else {
            onSectionChange({
                ...safeData,
                ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: true }
            });
        }
    };

    const handleArrayChange = (objKey: string, arrayKey: string, novoArray: any[]) => {
        onSectionChange({ ...safeData, [objKey]: { ...(safeData[objKey] || {}), [arrayKey]: novoArray } });
    };

    const colunasAnimaisServico: TableColumn[] = [
        { id: 'especie', label: 'Espécie', type: 'text' },
        { id: 'quantidade', label: 'Quantidade', type: 'number' },
        { id: 'manejo', label: 'Manejo', type: 'text' },
        { id: 'insumos', label: 'Insumos', type: 'text' },
        { id: 'tratamento_dejetos', label: 'Tratamento dos Dejetos', type: 'text' },
    ];

    return (
        <SectionShell sectionLabel="Seção 4" title="Animais de Serviço, Subsistência, Companhia e Outros">

            {/* Pergunta Sim/Não */}
            <fieldset className="mb-4">
                <legend className="text-sm font-bold text-gray-800 mb-2">
                    4.1. Há animais de serviço, subsistência, companhia ou ornamentais na propriedade?
                </legend>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ha_animais" value="true" checked={temAnimais}
                            onChange={handleSimNaoChange}
                            className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">Sim</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ha_animais" value="false" checked={!temAnimais}
                            onChange={handleSimNaoChange}
                            className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">Não</span>
                    </label>
                </div>
            </fieldset>

            {temAnimais && (
                <div className="flex flex-col gap-4 mt-2">
                    <AccordionPanel title="4.1.1 Animais de Serviço" defaultOpen>
                        <TabelaDinamica
                            columns={colunasAnimaisServico}
                            data={safeData.animais_servico?.lista_animais_servico || []}
                            onDataChange={(novoArray) => handleArrayChange('animais_servico', 'lista_animais_servico', novoArray)}
                            itemName="Animal de Serviço"
                            itemNoun="o"
                        />
                    </AccordionPanel>

                    <AccordionPanel title="4.1.2 Animais de Subsistência, Companhia e Outros">
                        <TabelaAnimaisSubsistencia
                            itens={safeData.animais_subsistencia_companhia_ornamentais?.lista_animais_subsistencia || []}
                            onItensChange={(novoArray) => handleArrayChange('animais_subsistencia_companhia_ornamentais', 'lista_animais_subsistencia', novoArray)}
                        />
                    </AccordionPanel>
                </div>
            )}
        </SectionShell>
    );
};

export default Secao4MUI;
