// src/components/PmoForm/Secao12_MUI.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup_MUI';

// Types
interface AcondicionamentoData {
    embalados_envasados_produtos?: string;
    embalados_envasados_descricao?: string;
    granel_produtos?: string;
    granel_descricao?: string;
}

interface Secao12Data {
    higienizacao_produtos_organicos?: { higienizacao_produtos_organicos?: string };
    ha_processamento_producao_organica?: boolean;
    descricao_processamento_producao_organica?: { descricao_processamento_producao_organica?: string };
    ha_processamento_producao_paralela?: boolean;
    descricao_processamento_producao_paralela?: { descricao_processamento_producao_paralela?: string };
    higienizacao_equipamentos_instalacoes?: { higienizacao_equipamentos_instalacoes?: string };
    acondicionamento_produtos?: AcondicionamentoData;
    produtos_sao_rotulados?: boolean;
    descricao_rotulagem?: { descricao_rotulagem?: string };
    procedimentos_armazenamento?: string;
    procedimentos_armazenamento_outros?: string;
    controle_pragas_instalacoes?: { controle_pragas_instalacoes?: string };
    transporte_produtos_organicos?: { transporte_produtos_organicos?: string };
    [key: string]: any;
}

interface Secao12MUIProps {
    data: Secao12Data | null | undefined;
    onSectionChange: (data: Secao12Data) => void;
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

// Textarea helper (DRY)
const tw_textarea = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none placeholder-gray-400 resize-y";

// Radio Sim/Não reutilizável
interface RadioSimNaoProps {
    name: string;
    value: boolean | undefined;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    children?: React.ReactNode;
}

const RadioSimNao: React.FC<RadioSimNaoProps> = ({ name, value, onChange, children }) => (
    <fieldset className="space-y-2">
        <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={name} value="true" checked={value === true} onChange={onChange}
                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                <span className="text-sm text-gray-700">Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={name} value="false" checked={value !== true} onChange={onChange}
                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                <span className="text-sm text-gray-700">Não</span>
            </label>
        </div>
        {value === true && children}
    </fieldset>
);

// Sub-componente: Acondicionamento
const AcondicionamentoProdutos: React.FC<{ data: AcondicionamentoData | undefined; onAcondicionamentoChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }> = ({ data, onAcondicionamentoChange }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">EMBALADOS/ENVASADOS</h4>
            <label className="block text-xs text-gray-500 mb-1">Cite quais produtos</label>
            <textarea name="embalados_envasados_produtos" value={data?.embalados_envasados_produtos || ''} onChange={onAcondicionamentoChange} rows={2} className={tw_textarea} />
            <label className="block text-xs text-gray-500 mb-1 mt-2">Descreva o procedimento</label>
            <textarea name="embalados_envasados_descricao" value={data?.embalados_envasados_descricao || ''} onChange={onAcondicionamentoChange} rows={2} className={tw_textarea} />
        </div>
        <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">A GRANEL</h4>
            <label className="block text-xs text-gray-500 mb-1">Cite quais produtos</label>
            <textarea name="granel_produtos" value={data?.granel_produtos || ''} onChange={onAcondicionamentoChange} rows={2} className={tw_textarea} />
            <label className="block text-xs text-gray-500 mb-1 mt-2">Descreva a identificação/separação</label>
            <textarea name="granel_descricao" value={data?.granel_descricao || ''} onChange={onAcondicionamentoChange} rows={2} className={tw_textarea} />
        </div>
    </div>
);

const Secao12MUI: React.FC<Secao12MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const camposAninhados = ['higienizacao_produtos_organicos', 'descricao_processamento_producao_organica', 'descricao_processamento_producao_paralela', 'higienizacao_equipamentos_instalacoes', 'descricao_rotulagem', 'controle_pragas_instalacoes', 'transporte_produtos_organicos'];

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let finalValue: string | boolean = value;
        if (name.startsWith('ha_') || name === 'produtos_sao_rotulados') finalValue = value === 'true';
        if (camposAninhados.includes(name)) {
            onSectionChange({ ...safeData, [name]: { [name]: finalValue as string } });
        } else {
            onSectionChange({ ...safeData, [name]: finalValue });
        }
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => onSectionChange({ ...safeData, [fieldName]: newValue });
    const handleAcondicionamentoChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onSectionChange({ ...safeData, acondicionamento_produtos: { ...(safeData.acondicionamento_produtos || {}), [e.target.name]: e.target.value } });

    return (
        <SectionShell sectionLabel="Seção 12" title="Pós-Colheita, Processamento e Transporte">

            <AccordionPanel title="12.1. Higienização dos produtos orgânicos" defaultOpen>
                <textarea name="higienizacao_produtos_organicos" value={safeData.higienizacao_produtos_organicos?.higienizacao_produtos_organicos || ''} onChange={handleChange} rows={3} className={tw_textarea} />
            </AccordionPanel>

            <AccordionPanel title="12.2. Processamento na produção orgânica?">
                <RadioSimNao name="ha_processamento_producao_organica" value={safeData.ha_processamento_producao_organica} onChange={handleChange}>
                    <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Descreva</label>
                        <textarea name="descricao_processamento_producao_organica" value={safeData.descricao_processamento_producao_organica?.descricao_processamento_producao_organica || ''} onChange={handleChange} rows={3} className={tw_textarea} />
                    </div>
                </RadioSimNao>
            </AccordionPanel>

            <AccordionPanel title="12.3. Processamento paralela (não orgânica)?">
                <RadioSimNao name="ha_processamento_producao_paralela" value={safeData.ha_processamento_producao_paralela} onChange={handleChange}>
                    <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Descreva</label>
                        <textarea name="descricao_processamento_producao_paralela" value={safeData.descricao_processamento_producao_paralela?.descricao_processamento_producao_paralela || ''} onChange={handleChange} rows={3} className={tw_textarea} />
                    </div>
                </RadioSimNao>
            </AccordionPanel>

            <AccordionPanel title="12.4. Higienização de equipamentos">
                <textarea name="higienizacao_equipamentos_instalacoes" value={safeData.higienizacao_equipamentos_instalacoes?.higienizacao_equipamentos_instalacoes || ''} onChange={handleChange} rows={3} className={tw_textarea} />
            </AccordionPanel>

            <AccordionPanel title="12.5. Acondicionamento dos produtos">
                <AcondicionamentoProdutos data={safeData.acondicionamento_produtos} onAcondicionamentoChange={handleAcondicionamentoChange} />
            </AccordionPanel>

            <AccordionPanel title="12.6. Produtos são rotulados?">
                <RadioSimNao name="produtos_sao_rotulados" value={safeData.produtos_sao_rotulados} onChange={handleChange}>
                    <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Descreva</label>
                        <textarea name="descricao_rotulagem" value={safeData.descricao_rotulagem?.descricao_rotulagem || ''} onChange={handleChange} rows={3} className={tw_textarea} />
                    </div>
                </RadioSimNao>
            </AccordionPanel>

            <AccordionPanel title="12.7. Procedimentos de armazenamento">
                <CheckboxGroupMUI
                    title=""
                    options={['Identificação clara de produtos orgânicos e não orgânicos', 'Local específico para armazenamento', 'Local limpo e higienizado', 'Equipamentos/embalagens adequados', 'Outros - citar:']}
                    selectedString={safeData.procedimentos_armazenamento}
                    onSelectionChange={(v) => handleCheckboxChange('procedimentos_armazenamento', v)}
                    otherOption="Outros - citar:"
                    otherValue={safeData.procedimentos_armazenamento_outros}
                    onOtherChange={handleChange as any}
                    otherName="procedimentos_armazenamento_outros"
                />
            </AccordionPanel>

            <AccordionPanel title="12.8. Controle de pragas em instalações">
                <textarea name="controle_pragas_instalacoes" value={safeData.controle_pragas_instalacoes?.controle_pragas_instalacoes || ''} onChange={handleChange} rows={3} className={tw_textarea} />
            </AccordionPanel>

            <AccordionPanel title="12.9. Transporte dos produtos orgânicos">
                <textarea name="transporte_produtos_organicos" value={safeData.transporte_produtos_organicos?.transporte_produtos_organicos || ''} onChange={handleChange} rows={3} className={tw_textarea} />
            </AccordionPanel>

        </SectionShell>
    );
};

export default Secao12MUI;
