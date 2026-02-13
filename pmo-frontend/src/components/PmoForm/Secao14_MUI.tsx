// src/components/PmoForm/Secao14_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, FormControl,
    FormGroup, FormControlLabel, Checkbox, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SectionShell from '../Plan/SectionShell';

// Types
interface CanalConfig {
    label: string;
    name?: string;
    placeholder?: string;
}

interface CanalCheckboxMUIProps {
    label: string;
    name?: string;
    checked: boolean;
    onChange: (value: string, isChecked: boolean) => void;
    conditionalValue?: string;
    onTextChange: (e: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}

interface Secao14Data {
    canais_comercializacao?: string;
    canais_atacadistas_quais?: string;
    canais_feiras_quais?: string;
    canais_cooperativas_quais?: string;
    canais_outros_quais?: string;
    [key: string]: any;
}

interface Secao14MUIProps {
    data: Secao14Data | null | undefined;
    onSectionChange: (data: Secao14Data) => void;
}

const CanalCheckboxMUI: React.FC<CanalCheckboxMUIProps> = ({ label, name, checked, onChange, conditionalValue, onTextChange, placeholder }) => {
    return (
        <Box>
            <FormControlLabel
                control={
                    <Checkbox
                        value={label}
                        checked={checked}
                        onChange={(e) => onChange(e.target.value, e.target.checked)}
                    />
                }
                label={label}
            />
            {checked && placeholder && (
                <TextField
                    name={name}
                    placeholder={placeholder}
                    value={conditionalValue || ''}
                    onChange={onTextChange}
                    variant="standard"
                    size="small"
                    fullWidth
                    sx={{ mb: 1, pl: 4 }}
                />
            )}
        </Box>
    );
};

const Secao14MUI: React.FC<Secao14MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const canaisSelecionados = String(safeData.canais_comercializacao || '').split('; ').filter(Boolean);

    const handleCheckboxChange = (value: string, isChecked: boolean) => {
        let novasOpcoes = [...canaisSelecionados];
        if (isChecked && !novasOpcoes.includes(value)) {
            novasOpcoes.push(value);
        } else {
            novasOpcoes = novasOpcoes.filter(opt => opt !== value);
        }
        onSectionChange({ ...safeData, canais_comercializacao: novasOpcoes.join('; ') });
    };

    const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({ ...safeData, [name]: value });
    };

    const canais: CanalConfig[] = [
        { label: 'Na unidade de produção.' },
        { label: 'Programa de Aquisição de Alimentos (PAA).' },
        { label: 'Programa Nacional de Alimentação Escolar (PNAE).' },
        { label: 'Em estabelecimentos atacadistas e varejistas – Quais:', name: 'canais_atacadistas_quais', placeholder: 'Especifique os estabelecimentos...' },
        { label: 'Em feiras – Quais:', name: 'canais_feiras_quais', placeholder: 'Especifique as feiras...' },
        { label: 'Em cooperativas e associações – Quais:', name: 'canais_cooperativas_quais', placeholder: 'Especifique as cooperativas/associações...' },
        { label: 'Em outros canais – Quais:', name: 'canais_outros_quais', placeholder: 'Especifique outros canais...' }
    ];

    return (
        <SectionShell sectionLabel="Seção 14" title="Comercialização">
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>14.1. Em quais canais os produtos são comercializados?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <FormControl component="fieldset" fullWidth>
                        <FormGroup sx={{ mt: 1 }}>
                            {canais.map(canal => (
                                <CanalCheckboxMUI
                                    key={canal.label}
                                    label={canal.label}
                                    name={canal.name}
                                    checked={canaisSelecionados.includes(canal.label)}
                                    onChange={handleCheckboxChange}
                                    conditionalValue={canal.name ? safeData[canal.name] : ''}
                                    onTextChange={handleTextChange}
                                    placeholder={canal.placeholder}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>
                </AccordionDetails>
            </Accordion>
        </SectionShell>
    );
};

export default Secao14MUI;
