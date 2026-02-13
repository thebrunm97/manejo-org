// src/components/PmoForm/Secao17_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SectionShell from '../Plan/SectionShell';

// Types
interface Secao17Data {
    principais_problemas_producao_organica?: { principais_problemas_producao_organica?: string };
    principais_vantagens_producao_organica?: { principais_vantagens_producao_organica?: string };
    outras_informacoes_necessarias?: { outras_informacoes_necessarias?: string };
    [key: string]: any;
}

interface Secao17MUIProps {
    data: Secao17Data | null | undefined;
    onSectionChange: (data: Secao17Data) => void;
}

const Secao17MUI: React.FC<Secao17MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: { [name]: value } });
    };

    return (
        <SectionShell sectionLabel="Seção 17" title="Opinião">
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>17.1. Quais os principais problemas enfrentados na produção orgânica?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="principais_problemas_producao_organica"
                        value={safeData.principais_problemas_producao_organica?.principais_problemas_producao_organica || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva os problemas aqui..."
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>17.2. Quais as principais vantagens da produção orgânica?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="principais_vantagens_producao_organica"
                        value={safeData.principais_vantagens_producao_organica?.principais_vantagens_producao_organica || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva as vantagens aqui..."
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>17.3. Outras informações que achar necessário.</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="outras_informacoes_necessarias"
                        value={safeData.outras_informacoes_necessarias?.outras_informacoes_necessarias || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Adicione outras informações aqui..."
                    />
                </AccordionDetails>
            </Accordion>
        </SectionShell>
    );
};

export default Secao17MUI;
