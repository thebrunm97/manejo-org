// src/components/PmoForm/Secao1_MUI.tsx
// Orchestrador — Zero MUI (sub-componentes serão refatorados no Sub-lote 6D)

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import SectionShell from '../Plan/SectionShell';

// Componentes filhos (ainda com MUI internamente — serão refatorados no Sub-lote 6D)
import DadosCadastraisMUI from './DadosCadastrais_MUI';
import RoteiroAcessoMUI from './RoteiroAcesso_MUI';
import MapaCroquiMUI from './MapaCroqui_MUI';
import CoordenadasMUI from './Coordenadas_MUI';
import AreaPropriedadeMUI from './AreaPropriedade_MUI';
import HistoricoMUI from './Historico_MUI';
import SituacaoMUI from './Situacao_MUI';
import SeparacaoAreasProducaoParalelaMUI from './SeparacaoAreasProducaoParalela_MUI';

// Types
interface Secao1Data {
    dados_cadastrais?: Record<string, any>;
    roteiro_acesso_propriedade?: Record<string, any>;
    mapa_propriedade_croqui?: Record<string, any>;
    coordenadas_geograficas?: Record<string, any>;
    area_propriedade?: Record<string, any>;
    historico_propriedade_producao_organica?: Record<string, any>;
    situacao_propriedade_relacao_producao_organica?: Record<string, any>;
    separacao_areas_producao_paralela?: Record<string, any>;
    [key: string]: any;
}

interface Secao1MUIProps {
    data: Secao1Data | null | undefined;
    onSectionChange: (data: Secao1Data) => void;
    errors?: Record<string, any>;
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

const Secao1MUI: React.FC<Secao1MUIProps> = ({ data, onSectionChange, errors }) => {
    const handleSubSectionChange = (subSectionName: string, subSectionData: any) => {
        onSectionChange({ ...data, [subSectionName]: subSectionData });
    };

    const safeData = data || {};
    const safeErrors = errors || {};

    return (
        <SectionShell sectionLabel="Seção 1" title="Descrição da Propriedade">
            <div className="flex flex-col gap-4">

                {/* --- 1.1 Dados Cadastrais --- */}
                <AccordionPanel title="1.1 Dados Cadastrais" defaultOpen>
                    <div className="w-full">
                        <DadosCadastraisMUI
                            data={safeData.dados_cadastrais}
                            onDataChange={(newData) => handleSubSectionChange('dados_cadastrais', newData)}
                            errors={safeErrors.dados_cadastrais}
                        />
                    </div>
                </AccordionPanel>

                {/* --- 1.2 Roteiro de Acesso e Croqui --- */}
                <AccordionPanel title="1.2 Roteiro de Acesso e Croqui">
                    <div className="w-full flex flex-col gap-6">
                        <RoteiroAcessoMUI
                            data={safeData.roteiro_acesso_propriedade}
                            onDataChange={(newData) => handleSubSectionChange('roteiro_acesso_propriedade', newData)}
                            errors={safeErrors.roteiro_acesso_propriedade}
                        />
                        <MapaCroquiMUI
                            data={safeData.mapa_propriedade_croqui}
                            onDataChange={(newData) => handleSubSectionChange('mapa_propriedade_croqui', newData)}
                            errors={safeErrors.mapa_propriedade_croqui}
                        />
                    </div>
                </AccordionPanel>

                {/* --- 1.3 Coordenadas e Área --- */}
                <AccordionPanel title="1.3 Coordenadas e Área">
                    <div className="w-full flex flex-col gap-6">
                        <div>
                            <h4 className="text-sm font-semibold text-green-700 mb-3">
                                Coordenadas Geográficas
                            </h4>
                            <CoordenadasMUI
                                data={safeData.coordenadas_geograficas}
                                onDataChange={(newData) => handleSubSectionChange('coordenadas_geograficas', newData)}
                                errors={safeErrors.coordenadas_geograficas}
                            />
                        </div>

                        <hr className="border-gray-200" />

                        <div>
                            <AreaPropriedadeMUI
                                data={safeData.area_propriedade}
                                onDataChange={(newData) => handleSubSectionChange('area_propriedade', newData)}
                                errors={safeErrors.area_propriedade}
                            />
                        </div>
                    </div>
                </AccordionPanel>

                {/* --- 1.4 Histórico da Propriedade --- */}
                <AccordionPanel title="1.4 Histórico da Propriedade">
                    <div className="w-full">
                        <HistoricoMUI
                            data={safeData.historico_propriedade_producao_organica}
                            onDataChange={(newData) => handleSubSectionChange('historico_propriedade_producao_organica', newData)}
                            errors={safeErrors.historico_propriedade_producao_organica}
                        />
                    </div>
                </AccordionPanel>

                {/* --- 1.5 Situação da Propriedade --- */}
                <AccordionPanel title="1.5 Situação da Propriedade">
                    <div className="w-full">
                        <SituacaoMUI
                            data={safeData.situacao_propriedade_relacao_producao_organica}
                            onDataChange={(newData) => handleSubSectionChange('situacao_propriedade_relacao_producao_organica', newData)}
                            errors={safeErrors.situacao_propriedade_producao_organica}
                        />
                    </div>
                </AccordionPanel>

                {/* --- 1.6 Separação de Áreas (Produção Paralela) --- */}
                <AccordionPanel title="1.6 Separação de Áreas (Produção Paralela)">
                    <div className="w-full">
                        <SeparacaoAreasProducaoParalelaMUI
                            data={safeData.separacao_areas_producao_paralela}
                            onDataChange={(newData) => handleSubSectionChange('separacao_areas_producao_paralela', newData)}
                            errors={safeErrors.separacao_areas_producao_paralela}
                        />
                    </div>
                </AccordionPanel>

            </div>
        </SectionShell>
    );
};

export default Secao1MUI;
