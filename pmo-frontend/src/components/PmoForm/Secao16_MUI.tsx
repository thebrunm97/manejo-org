// src/components/PmoForm/Secao16_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SectionShell from '../Plan/SectionShell';

// Types
interface Secao16Data {
    formas_reclamacoes_criticas?: { formas_reclamacoes_criticas?: string };
    tratamento_reclamacoes_criticas?: { tratamento_reclamacoes_criticas?: string };
    [key: string]: any;
}

interface Secao16MUIProps {
    data: Secao16Data | null | undefined;
    onSectionChange: (data: Secao16Data) => void;
}

const Secao16MUI: React.FC<Secao16MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: { [name]: value } });
    };

    return (
        <SectionShell sectionLabel="Seção 16" title="SAC (Serviço de Atendimento ao Consumidor)">
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>16.1. Quais são as formas dos consumidores fazerem reclamações ou críticas aos produtos?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="formas_reclamacoes_criticas"
                        value={safeData.formas_reclamacoes_criticas?.formas_reclamacoes_criticas || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva as formas de contato aqui..."
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>16.2. Como são tratadas possíveis reclamações ou críticas recebidas dos consumidores?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="tratamento_reclamacoes_criticas"
                        value={safeData.tratamento_reclamacoes_criticas?.tratamento_reclamacoes_criticas || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva o procedimento de tratamento aqui..."
                    />
                </AccordionDetails>
            </Accordion>
        </SectionShell>
    );
};

export default Secao16MUI;
