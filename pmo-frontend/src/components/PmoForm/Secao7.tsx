// src/components/PmoForm/Secao7.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react + TabelaDinamica standard.

import React, { useState, ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

// Types
interface MembroFamilia {
    id: string | number;
    nome?: string;
    parentesco?: string;
    funcao?: string;
}

interface Secao7Data {
    membros_familia_producao?: MembroFamilia[];
    ha_mao_de_obra_nao_familiar?: boolean;
    quantidade_mao_de_obra?: string | number;
    relacao_trabalhista?: string;
    incentivo_atividades_educativas?: string;
    incentivo_atividades_outros?: string;
    relacionamento_outros_produtores?: string;
    [key: string]: any;
}

interface Secao7MUIProps {
    data: Secao7Data | null | undefined;
    onSectionChange: (data: Secao7Data) => void;
    errors?: Record<string, string>;
}

/**
 * Accordion Panel helper with fixed button type to prevent accidental submits.
 */
const AccordionPanel: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <span className="font-bold text-sm text-gray-800">{title}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="p-4">{children}</div>}
        </div>
    );
};


const Secao7MUI: React.FC<Secao7MUIProps> = ({ data, onSectionChange, errors }) => {
    const safeData = data || {};

    // Configuração das colunas para os membros da família
    const familyColumns: TableColumn[] = [
        { id: 'nome', label: 'Nome do Membro', type: 'text' },
        { id: 'parentesco', label: 'Parentesco', type: 'text' },
        { id: 'funcao', label: 'Função na Produção', type: 'text' },
    ];

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue: string | boolean = value;
        if (name === "ha_mao_de_obra_nao_familiar") {
            finalValue = value === 'true';
        }
        onSectionChange({ ...safeData, [name]: finalValue });
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => {
        onSectionChange({ ...safeData, [fieldName]: newValue });
    };

    const handleFamilyDataChange = (newMembros: MembroFamilia[]) => {
        onSectionChange({ ...safeData, membros_familia_producao: newMembros });
    };

    return (
        <SectionShell
            sectionLabel="Seção 7"
            title="Aspectos Sociais"
        >
            <div className="flex flex-col gap-3">
                <AccordionPanel title="7.1. Quais os membros da família estão envolvidos na produção?" defaultOpen>
                    <TabelaDinamica<MembroFamilia>
                        columns={familyColumns}
                        data={safeData.membros_familia_producao || []}
                        onDataChange={handleFamilyDataChange}
                        itemName="Membro da Família"
                        itemNoun="o"
                    />
                </AccordionPanel>

                <AccordionPanel title="7.2. Há mão de obra que não seja da família?">
                    <div>
                        <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input type="radio" name="ha_mao_de_obra_nao_familiar" value="true" checked={String(safeData.ha_mao_de_obra_nao_familiar ?? 'false') === 'true'} onChange={handleChange} className="w-4 h-4" /> Sim
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input type="radio" name="ha_mao_de_obra_nao_familiar" value="false" checked={String(safeData.ha_mao_de_obra_nao_familiar ?? 'false') === 'false'} onChange={handleChange} className="w-4 h-4" /> Não
                            </label>
                        </div>
                        {safeData.ha_mao_de_obra_nao_familiar === true && (
                            <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Quantas pessoas?</label>
                                    <input type="number" name="quantidade_mao_de_obra" value={safeData.quantidade_mao_de_obra || ''} onChange={handleChange} className="w-48 border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                                </div>
                                <CheckboxGroupMUI
                                    title="Qual a relação trabalhista?"
                                    options={['Trabalhador temporário', 'Trabalhador permanente', 'Parceria']}
                                    selectedString={safeData.relacao_trabalhista}
                                    onSelectionChange={(newValue) => handleCheckboxChange('relacao_trabalhista', newValue)}
                                />
                            </div>
                        )}
                    </div>
                </AccordionPanel>

                <AccordionPanel title="7.3. Incentiva e promove atividades educativas envolvendo família e/ou funcionário?">
                    <CheckboxGroupMUI
                        title="Se sim, qual(is)?"
                        options={['Incentivo à escolarização', 'Cursos', 'Outras. Quais?']}
                        selectedString={safeData.incentivo_atividades_educativas}
                        onSelectionChange={(newValue) => handleCheckboxChange('incentivo_atividades_educativas', newValue)}
                        otherOption="Outras. Quais?"
                        otherValue={safeData.incentivo_atividades_outros}
                        onOtherChange={handleChange}
                        otherName="incentivo_atividades_outros"
                        otherPlaceholder="Especifique as outras atividades..."
                    />
                </AccordionPanel>

                <AccordionPanel title="7.4. Como se relaciona com outros produtores e com as atividades culturais?">
                    <CheckboxGroupMUI
                        title=""
                        options={['Participa de associação de produção ou associação comunitária.', 'Participa de atividades que valorizam a cultura local.', 'Promove atividades culturais que valorizam a cultura local.']}
                        selectedString={safeData.relacionamento_outros_produtores}
                        onSelectionChange={(newValue) => handleCheckboxChange('relacionamento_outros_produtores', newValue)}
                    />
                </AccordionPanel>
            </div>
        </SectionShell>
    );
};

export default Secao7MUI;
