// src/components/PmoForm/Secao6.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup';

// Types
interface Secao6Data {
    promocao_biodiversidade?: string;
    fonte_agua?: string;
    fonte_agua_subterranea_especificacao?: string;
    controle_uso_agua?: string;
    ha_risco_contaminacao_agua?: boolean;
    qual_risco_contaminacao_agua?: string;
    riscos_contaminacao_unidade_producao?: string;
    medidas_minimizar_riscos_contaminacao?: string;
    praticas_manejo_residuos_organicos?: string;
    compostagem?: string;
    tratamento_lixo?: string;
    [key: string]: any;
}

interface Secao6MUIProps {
    data: Secao6Data | null | undefined;
    onSectionChange: (data: Secao6Data) => void;
    errors?: Record<string, string>;
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

const Secao6MUI: React.FC<Secao6MUIProps> = ({ data, onSectionChange, errors }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let finalValue: string | boolean = value;
        if (name === "ha_risco_contaminacao_agua") {
            finalValue = value === 'true';
        }
        onSectionChange({ ...safeData, [name]: finalValue });
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => {
        onSectionChange({ ...safeData, [fieldName]: newValue });
    };

    return (
        <SectionShell sectionLabel="Seção 6" title="Aspectos Ambientais">

            <AccordionPanel
                title="6.1. Como irá promover a biodiversidade, conservar o solo e a água e proteger as fontes e nascentes?"
                defaultOpen
            >
                <CheckboxGroupMUI
                    title=""
                    options={['Culturas consorciadas', 'Sistemas agroflorestais', 'Rotação de culturas', 'Plantio em nível', 'Recuperação/enriquecimento de APPs', 'Plantio direto', 'Corredor ecológico...', 'Preservação da mata ciliar', 'Manejo do mato...', 'Cercamento de nascentes', 'Ausência de fogo', 'Terraceamento', 'Adubação verde', 'Mantém nascente de água própria', 'Adubos orgânicos', 'Realiza manejo das águas residuais', 'Diversificação da produção', 'Evita o desperdício de água', 'Plantio de flores...', 'Orienta vizinhos', 'Cultivo em aleias/faixas', 'Quebra ventos', 'Cobertura do solo']}
                    selectedString={safeData.promocao_biodiversidade}
                    onSelectionChange={(newValue) => handleCheckboxChange('promocao_biodiversidade', newValue)}
                />
            </AccordionPanel>

            <AccordionPanel title="6.2. Qual a fonte de água utilizada na propriedade?">
                <CheckboxGroupMUI
                    title=""
                    options={['Mina própria...', 'Cisterna', 'Açude', 'Mina fora da propriedade', 'Rio ou riacho', 'Canais coletivos...', 'Água subterrânea - Qual?']}
                    selectedString={safeData.fonte_agua}
                    onSelectionChange={(newValue) => handleCheckboxChange('fonte_agua', newValue)}
                    otherOption="Água subterrânea - Qual?"
                    otherValue={safeData.fonte_agua_subterranea_especificacao}
                    onOtherChange={handleChange as any}
                    otherName="fonte_agua_subterranea_especificacao"
                />
            </AccordionPanel>

            <AccordionPanel title="6.3. Como controla o uso da água na produção?">
                <textarea
                    name="controle_uso_agua"
                    value={safeData.controle_uso_agua || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel title="6.4. Há risco de contaminação para sua água?">
                <fieldset className="space-y-2">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="ha_risco_contaminacao_agua"
                                value="true"
                                checked={safeData.ha_risco_contaminacao_agua === true}
                                onChange={handleChange}
                                className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">Sim</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="ha_risco_contaminacao_agua"
                                value="false"
                                checked={safeData.ha_risco_contaminacao_agua !== true}
                                onChange={handleChange}
                                className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">Não</span>
                        </label>
                    </div>
                    {safeData.ha_risco_contaminacao_agua === true && (
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Qual(is)?</label>
                            <textarea
                                name="qual_risco_contaminacao_agua"
                                value={safeData.qual_risco_contaminacao_agua || ''}
                                onChange={handleChange}
                                rows={3}
                                className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                                           focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                                           placeholder-gray-400 resize-y"
                            />
                        </div>
                    )}
                </fieldset>
            </AccordionPanel>

            <AccordionPanel title="6.5. Quais os principais riscos de contaminação existentes na sua unidade de produção?">
                <CheckboxGroupMUI
                    title=""
                    options={['Cultivos transgênicos...', 'Uso de insumos químicos...', 'Contaminação por pulverização...', 'Contaminação dos cursos...', 'Enxurrada', 'Insumos externos...', 'Animais trazidos de fora...']}
                    selectedString={safeData.riscos_contaminacao_unidade_producao}
                    onSelectionChange={(newValue) => handleCheckboxChange('riscos_contaminacao_unidade_producao', newValue)}
                />
            </AccordionPanel>

            <AccordionPanel title="6.6. Como pretende diminuir ou eliminar os riscos de contaminação identificados?">
                <textarea
                    name="medidas_minimizar_riscos_contaminacao"
                    value={safeData.medidas_minimizar_riscos_contaminacao || ''}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel title="6.7. Que práticas são adotadas para o manejo de resíduos orgânicos?">
                <CheckboxGroupMUI
                    title=""
                    options={['Acumula o esterco...', 'Faz compostagem', 'Coloca no biodigestor', 'Produz biofertilizante', 'Faz vermicompostagem/húmus', 'Utiliza na alimentação de animais']}
                    selectedString={safeData.praticas_manejo_residuos_organicos}
                    onSelectionChange={(newValue) => handleCheckboxChange('praticas_manejo_residuos_organicos', newValue)}
                />
            </AccordionPanel>

            <AccordionPanel title="6.8. Compostagem">
                <textarea
                    name="compostagem"
                    value={safeData.compostagem || ''}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

            <AccordionPanel title="6.9. Como é tratado/manejado o lixo na propriedade?">
                <textarea
                    name="tratamento_lixo"
                    value={safeData.tratamento_lixo || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                               focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                               placeholder-gray-400 resize-y"
                />
            </AccordionPanel>

        </SectionShell>
    );
};

export default Secao6MUI;
