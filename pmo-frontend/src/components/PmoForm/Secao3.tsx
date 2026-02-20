// src/components/PmoForm/Secao3.tsx
// Clonado do Template Canónico — Zero MUI

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

// Types
interface Secao3Data {
    produtos_nao_certificados?: boolean;
    producao_primaria_vegetal_nao_organica?: {
        produtos_primaria_vegetal_nao_organica?: any[];
    };
    producao_primaria_animal_nao_organica?: {
        animais_primaria_animal_nao_organica?: any[];
    };
    processamento_produtos_origem_vegetal_nao_organico?: {
        produtos_processamento_vegetal_nao_organico?: any[];
    };
    processamento_produtos_origem_animal_nao_organico?: {
        produtos_processamento_animal_nao_organico?: any[];
    };
    [key: string]: any;
}

interface Secao3MUIProps {
    data: Secao3Data | null | undefined;
    onSectionChange: (data: Secao3Data) => void;
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

const Secao3MUI: React.FC<Secao3MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newValue = value === 'true';
        onSectionChange({ ...safeData, [name]: newValue });
    };

    const handleArrayChange = (objKey: string, arrayKey: string, novoArray: any[]) => {
        onSectionChange({
            ...safeData,
            [objKey]: {
                ...safeData[objKey],
                [arrayKey]: novoArray
            }
        });
    };

    const columnsVegetal: TableColumn[] = [
        { id: 'produto', label: 'Produto', type: 'text' },
        { id: 'talhoes_canteiros', label: 'Talhões/Canteiros', type: 'text' },
        { id: 'area_plantada', label: 'Área Plantada', type: 'number' },
        { id: 'producao_esperada_ano', label: 'Produção Esperada/Ano', type: 'number' }
    ];

    const columnsAnimal: TableColumn[] = [
        { id: 'especie', label: 'Espécie', type: 'text' },
        { id: 'n_de_animais', label: 'Nº de animais', type: 'number' },
        { id: 'area_externa', label: 'Área Externa', type: 'number' },
        { id: 'area_interna_instalacoes', label: 'Área Interna', type: 'number' },
        { id: 'exploracao', label: 'Exploração', type: 'text' },
        { id: 'estagio_de_vida', label: 'Estágio de Vida', type: 'text' },
        { id: 'media_de_peso_vivo', label: 'Média de Peso Vivo', type: 'number' },
        { id: 'producao_esperada_ano', label: 'Produção Esperada/Ano', type: 'text' }
    ];

    const columnsProcessamento: TableColumn[] = [
        { id: 'produto', label: 'Produto', type: 'text' },
        { id: 'frequencia_producao', label: 'Frequência', type: 'text' },
        { id: 'epoca_producao', label: 'Época', type: 'text' },
        { id: 'producao_esperada_ano', label: 'Produção Esperada/Ano', type: 'text' }
    ];

    return (
        <SectionShell sectionLabel="Seção 3" title="Atividades Produtivas Não Orgânicas (Convencionais)">

            {/* Pergunta Sim/Não */}
            <fieldset className="mb-4">
                <legend className="text-sm font-bold text-gray-800 mb-2">
                    A propriedade possui atividades produtivas não orgânicas (convencionais)?
                </legend>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="produtos_nao_certificados" value="true"
                            checked={safeData.produtos_nao_certificados === true}
                            onChange={handleChange}
                            className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">Sim</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="produtos_nao_certificados" value="false"
                            checked={safeData.produtos_nao_certificados === false}
                            onChange={handleChange}
                            className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">Não</span>
                    </label>
                </div>
            </fieldset>

            {safeData.produtos_nao_certificados && (
                <div className="flex flex-col gap-4 mt-2">
                    <AccordionPanel title="3.1. Produção Primária Vegetal Não Orgânica" defaultOpen>
                        <TabelaDinamica
                            columns={columnsVegetal}
                            data={safeData.producao_primaria_vegetal_nao_organica?.produtos_primaria_vegetal_nao_organica}
                            onDataChange={(newData) => handleArrayChange('producao_primaria_vegetal_nao_organica', 'produtos_primaria_vegetal_nao_organica', newData)}
                            itemName="Produto Não Orgânico"
                            itemNoun="o"
                        />
                    </AccordionPanel>

                    <AccordionPanel title="3.2. Produção Primária Animal Não Orgânica">
                        <TabelaDinamica
                            columns={columnsAnimal}
                            data={safeData.producao_primaria_animal_nao_organica?.animais_primaria_animal_nao_organica}
                            onDataChange={(newData) => handleArrayChange('producao_primaria_animal_nao_organica', 'animais_primaria_animal_nao_organica', newData)}
                            itemName="Animal Não Orgânico"
                            itemNoun="o"
                        />
                    </AccordionPanel>

                    <AccordionPanel title="3.3. Processamento de Produtos de Origem Vegetal Não Orgânico">
                        <TabelaDinamica
                            columns={columnsProcessamento}
                            data={safeData.processamento_produtos_origem_vegetal_nao_organico?.produtos_processamento_vegetal_nao_organico}
                            onDataChange={(newData) => handleArrayChange('processamento_produtos_origem_vegetal_nao_organico', 'produtos_processamento_vegetal_nao_organico', newData)}
                            itemName="Produto Processado (Vegetal)"
                            itemNoun=""
                        />
                    </AccordionPanel>

                    <AccordionPanel title="3.4. Processamento de Produtos de Origem Animal Não Orgânico">
                        <TabelaDinamica
                            columns={columnsProcessamento}
                            data={safeData.processamento_produtos_origem_animal_nao_organico?.produtos_processamento_animal_nao_organico}
                            onDataChange={(newData) => handleArrayChange('processamento_produtos_origem_animal_nao_organico', 'produtos_processamento_animal_nao_organico', newData)}
                            itemName="Produto Processado (Animal)"
                            itemNoun=""
                        />
                    </AccordionPanel>
                </div>
            )}
        </SectionShell>
    );
};

export default Secao3MUI;
