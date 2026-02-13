// src/components/PmoForm/Secao11_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import SectionShell from '../Plan/SectionShell';

// Types
interface Secao11Data {
    controle_colheita_organicos?: { controle_colheita_organicos?: string };
    controle_colheita_nao_organicos?: { controle_colheita_nao_organicos?: string };
    [key: string]: any;
}

interface Secao11MUIProps {
    data: Secao11Data | null | undefined;
    onSectionChange: (data: Secao11Data) => void;
}

const Secao11MUI: React.FC<Secao11MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    // Handler para os campos de texto aninhados
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({
            ...safeData,
            [name]: { [name]: value }
        });
    };

    return (
        <SectionShell
            sectionLabel="Seção 11"
            title="Colheita"
        >

            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                        11.1. Como é controlada a colheita dos produtos orgânicos?
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="controle_colheita_organicos"
                        value={safeData.controle_colheita_organicos?.controle_colheita_organicos || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva as formas de controle aqui..."
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                        11.2. Nos casos de produção paralela, como é controlada a colheita dos produtos não orgânicos e como é feita a separação?
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        name="controle_colheita_nao_organicos"
                        value={safeData.controle_colheita_nao_organicos?.controle_colheita_nao_organicos || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Descreva as formas de controle e separação aqui..."
                    />
                </AccordionDetails>
            </Accordion>

        </SectionShell>
    );
};

export default Secao11MUI;
