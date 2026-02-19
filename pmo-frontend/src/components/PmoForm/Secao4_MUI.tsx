// src/components/PmoForm/Secao4_MUI.tsx

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

// O subcomponente customizado
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
        <SectionShell
            sectionLabel="Seção 4"
            title="Animais de Serviço, Subsistência, Companhia e Outros"
        >
            <FormControl component="fieldset" margin="normal" fullWidth>
                <FormLabel component="legend">
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>4.1. Há animais de serviço, subsistência, companhia ou ornamentais na propriedade?</Typography>
                </FormLabel>
                <RadioGroup row name="ha_animais" value={String(temAnimais)} onChange={handleSimNaoChange}>
                    <FormControlLabel value="true" control={<Radio />} label="Sim" />
                    <FormControlLabel value="false" control={<Radio />} label="Não" />
                </RadioGroup>
            </FormControl>

            {temAnimais && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>4.1.1 Animais de Serviço</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaDinamica
                                columns={colunasAnimaisServico}
                                data={safeData.animais_servico?.lista_animais_servico || []}
                                onDataChange={(novoArray) => handleArrayChange('animais_servico', 'lista_animais_servico', novoArray)}
                                itemName="Animal de Serviço"
                                itemNoun="o"
                            />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 'bold' }}>4.1.2 Animais de Subsistência, Companhia e Outros</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TabelaAnimaisSubsistencia
                                itens={safeData.animais_subsistencia_companhia_ornamentais?.lista_animais_subsistencia || []}
                                onItensChange={(novoArray) => handleArrayChange('animais_subsistencia_companhia_ornamentais', 'lista_animais_subsistencia', novoArray)}
                            />
                        </AccordionDetails>
                    </Accordion>
                </Box>
            )}
        </SectionShell>
    );
};

export default Secao4MUI;
