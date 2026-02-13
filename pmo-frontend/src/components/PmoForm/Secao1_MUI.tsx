// src/components/PmoForm/Secao1_MUI.tsx

import React from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box,
    Typography, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Componente de layout padrão
import SectionShell from '../Plan/SectionShell';

// Componentes filhos
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

const Secao1MUI: React.FC<Secao1MUIProps> = ({ data, onSectionChange, errors }) => {
    const handleSubSectionChange = (subSectionName: string, subSectionData: any) => {
        onSectionChange({ ...data, [subSectionName]: subSectionData });
    };

    const safeData = data || {};
    const safeErrors = errors || {};

    return (
        <SectionShell
            sectionLabel="Seção 1"
            title="Descrição da Propriedade"
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* --- 1.1 Dados Cadastrais --- */}
                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.1 Dados Cadastrais</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1 }}>
                            <DadosCadastraisMUI
                                data={safeData.dados_cadastrais}
                                onDataChange={(newData) => handleSubSectionChange('dados_cadastrais', newData)}
                                errors={safeErrors.dados_cadastrais}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* --- 1.2 Roteiro de Acesso e Croqui --- */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.2 Roteiro de Acesso e Croqui</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* --- 1.3 Coordenadas e Área --- */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.3 Coordenadas e Área</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>
                                    Coordenadas Geográficas
                                </Typography>
                                <CoordenadasMUI
                                    data={safeData.coordenadas_geograficas}
                                    onDataChange={(newData) => handleSubSectionChange('coordenadas_geograficas', newData)}
                                    errors={safeErrors.coordenadas_geograficas}
                                />
                            </Box>

                            <Divider />

                            <Box sx={{ px: 2, py: 1 }}>
                                <AreaPropriedadeMUI
                                    data={safeData.area_propriedade}
                                    onDataChange={(newData) => handleSubSectionChange('area_propriedade', newData)}
                                    errors={safeErrors.area_propriedade}
                                />
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* --- 1.4 Histórico da Propriedade --- */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.4 Histórico da Propriedade</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1 }}>
                            <HistoricoMUI
                                data={safeData.historico_propriedade_producao_organica}
                                onDataChange={(newData) => handleSubSectionChange('historico_propriedade_producao_organica', newData)}
                                errors={safeErrors.historico_propriedade_producao_organica}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* --- 1.5 Situação da Propriedade --- */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.5 Situação da Propriedade</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1 }}>
                            <SituacaoMUI
                                data={safeData.situacao_propriedade_relacao_producao_organica}
                                onDataChange={(newData) => handleSubSectionChange('situacao_propriedade_relacao_producao_organica', newData)}
                                errors={safeErrors.situacao_propriedade_producao_organica}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* --- 1.6 Separação de Áreas (Produção Paralela) --- */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>1.6 Separação de Áreas (Produção Paralela)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ width: '100%', px: 2, py: 1 }}>
                            <SeparacaoAreasProducaoParalelaMUI
                                data={safeData.separacao_areas_producao_paralela}
                                onDataChange={(newData) => handleSubSectionChange('separacao_areas_producao_paralela', newData)}
                                errors={safeErrors.separacao_areas_producao_paralela}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>

            </Box>
        </SectionShell>
    );
};

export default Secao1MUI;
