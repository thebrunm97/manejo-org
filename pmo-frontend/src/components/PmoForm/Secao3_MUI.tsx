// src/components/PmoForm/Secao3_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box,
    FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Componente de layout padrão
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
        <SectionShell
            sectionLabel="Seção 3"
            title="Atividades Produtivas Não Orgânicas (Convencionais)"
        >
            <FormControl component="fieldset" margin="normal" fullWidth>
                <FormLabel component="legend">
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>A propriedade possui atividades produtivas não orgânicas (convencionais)?</Typography>
                </FormLabel>
                <RadioGroup
                    row
                    name="produtos_nao_certificados"
                    value={String(safeData.produtos_nao_certificados ?? '')}
                    onChange={handleChange}
                >
                    <FormControlLabel value="true" control={<Radio />} label="Sim" />
                    <FormControlLabel value="false" control={<Radio />} label="Não" />
                </RadioGroup>
            </FormControl>

            {safeData.produtos_nao_certificados && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>3.1. Produção Primária Vegetal Não Orgânica</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaDinamica
                                columns={columnsVegetal}
                                data={safeData.producao_primaria_vegetal_nao_organica?.produtos_primaria_vegetal_nao_organica}
                                onDataChange={(newData) => handleArrayChange('producao_primaria_vegetal_nao_organica', 'produtos_primaria_vegetal_nao_organica', newData)}
                                itemName="Produto Não Orgânico"
                                itemNoun="o"
                            />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>3.2. Produção Primária Animal Não Orgânica</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaDinamica
                                columns={columnsAnimal}
                                data={safeData.producao_primaria_animal_nao_organica?.animais_primaria_animal_nao_organica}
                                onDataChange={(newData) => handleArrayChange('producao_primaria_animal_nao_organica', 'animais_primaria_animal_nao_organica', newData)}
                                itemName="Animal Não Orgânico"
                                itemNoun="o"
                            />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>3.3. Processamento de Produtos de Origem Vegetal Não Orgânico</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaDinamica
                                columns={columnsProcessamento}
                                data={safeData.processamento_produtos_origem_vegetal_nao_organico?.produtos_processamento_vegetal_nao_organico}
                                onDataChange={(newData) => handleArrayChange('processamento_produtos_origem_vegetal_nao_organico', 'produtos_processamento_vegetal_nao_organico', newData)}
                                itemName="Produto Processado (Vegetal)"
                                itemNoun=""
                            />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>3.4. Processamento de Produtos de Origem Animal Não Orgânico</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaDinamica
                                columns={columnsProcessamento}
                                data={safeData.processamento_produtos_origem_animal_nao_organico?.produtos_processamento_animal_nao_organico}
                                onDataChange={(newData) => handleArrayChange('processamento_produtos_origem_animal_nao_organico', 'produtos_processamento_animal_nao_organico', newData)}
                                itemName="Produto Processado (Animal)"
                                itemNoun=""
                            />
                        </AccordionDetails>
                    </Accordion>
                </Box>
            )}
        </SectionShell>
    );
};

export default Secao3MUI;
