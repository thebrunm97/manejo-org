// src/components/PmoForm/Secao15_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckboxGroupMUI from './CheckboxGroup_MUI';
import SectionShell from '../Plan/SectionShell';

// Types
interface Secao15Data {
    registros_rastreabilidade?: { registros_rastreabilidade?: string };
    frequencia_registros_anotacoes?: string;
    frequencia_registros_anotacoes_outros?: string;
    [key: string]: any;
}

interface Secao15MUIProps {
    data: Secao15Data | null | undefined;
    onSectionChange: (data: Secao15Data) => void;
}

const Secao15MUI: React.FC<Secao15MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'registros_rastreabilidade') {
            onSectionChange({ ...safeData, [name]: { [name]: value } });
        } else {
            onSectionChange({ ...safeData, [name]: value });
        }
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => {
        onSectionChange({ ...safeData, [fieldName]: newValue });
    };

    return (
        <SectionShell sectionLabel="Seção 15" title="Rastreabilidade (Documentos/Registros)">
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>15.1. Que tipo de registros são adotados para comprovar a rastreabilidade?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>Inclua produção, armazenamento, processamento, aquisições e vendas.</Typography>
                    <TextField
                        name="registros_rastreabilidade"
                        value={safeData.registros_rastreabilidade?.registros_rastreabilidade || ''}
                        onChange={handleChange}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>15.2. Com que frequência realiza os registros/anotações?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <CheckboxGroupMUI
                        title=""
                        options={['Diário', 'Semanal', 'Quinzenal', 'Mensal', 'Outro(s) - Qual(is)?']}
                        selectedString={safeData.frequencia_registros_anotacoes}
                        onSelectionChange={(newValue) => handleCheckboxChange('frequencia_registros_anotacoes', newValue)}
                        otherOption="Outro(s) - Qual(is)?"
                        otherValue={safeData.frequencia_registros_anotacoes_outros}
                        onOtherChange={handleChange}
                        otherName="frequencia_registros_anotacoes_outros"
                        otherPlaceholder="Especifique a outra frequência..."
                    />
                </AccordionDetails>
            </Accordion>
        </SectionShell>
    );
};

export default Secao15MUI;
