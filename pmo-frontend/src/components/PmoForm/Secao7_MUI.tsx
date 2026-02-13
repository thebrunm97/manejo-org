// src/components/PmoForm/Secao7_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControl, FormLabel,
    RadioGroup, FormControlLabel, Radio, Typography, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, TextField, IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup_MUI';

// Types
interface MembroFamilia {
    nome?: string;
    parentesco?: string;
    funcao?: string;
}

interface TabelaMembrosFamiliaMUIProps {
    membros: MembroFamilia[] | undefined;
    onMembrosChange: (membros: MembroFamilia[]) => void;
}

interface Secao7Data {
    membros_familia_producao?: MembroFamilia[];
    ha_mao_de_obra_nao_familiar?: boolean;
    quantidade_mao_de_obra?: string | number;
    relacao_trabalhista?: string;
    incentivo_atividades_educativas?: string;
    incentivo_atividades_outros?: string;
    relacionamento_outros_produtores?: string;
    [key: string]: any;
}

interface Secao7MUIProps {
    data: Secao7Data | null | undefined;
    onSectionChange: (data: Secao7Data) => void;
    errors?: Record<string, string>;
}

const TabelaMembrosFamiliaMUI: React.FC<TabelaMembrosFamiliaMUIProps> = ({ membros, onMembrosChange }) => {
    const membrosArray = Array.isArray(membros) ? membros : [];

    const handleMemberChange = (index: number, field: keyof MembroFamilia, value: string) => {
        const novosMembros = [...membrosArray];
        novosMembros[index] = { ...novosMembros[index], [field]: value };
        onMembrosChange(novosMembros);
    };

    const adicionarMembro = () => {
        onMembrosChange([...membrosArray, { nome: '', parentesco: '', funcao: '' }]);
    };

    const removerMembro = (index: number) => {
        onMembrosChange(membrosArray.filter((_, i) => i !== index));
    };

    return (
        <Box>
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Nome do Membro</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Parentesco</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Função na Produção</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Ação</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {membrosArray.map((membro, index) => (
                            <TableRow key={index}>
                                <TableCell><TextField variant="standard" fullWidth value={membro.nome || ''} onChange={(e) => handleMemberChange(index, 'nome', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={membro.parentesco || ''} onChange={(e) => handleMemberChange(index, 'parentesco', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={membro.funcao || ''} onChange={(e) => handleMemberChange(index, 'funcao', e.target.value)} /></TableCell>
                                <TableCell align="center">
                                    <IconButton onClick={() => removerMembro(index)} color="error"><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Button startIcon={<AddCircleOutlineIcon />} onClick={adicionarMembro} sx={{ mt: 2 }}>
                Adicionar Membro
            </Button>
        </Box>
    );
};


const Secao7MUI: React.FC<Secao7MUIProps> = ({ data, onSectionChange, errors }) => {
    const safeData = data || {};

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue: string | boolean = value;
        if (name === "ha_mao_de_obra_nao_familiar") {
            finalValue = value === 'true';
        }
        onSectionChange({ ...safeData, [name]: finalValue });
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => {
        onSectionChange({ ...safeData, [fieldName]: newValue });
    };

    return (
        <SectionShell
            sectionLabel="Seção 7"
            title="Aspectos Sociais"
        >

            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>7.1. Quais os membros da família estão envolvidos na produção?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TabelaMembrosFamiliaMUI
                        membros={safeData.membros_familia_producao}
                        onMembrosChange={(newMembros) => onSectionChange({ ...safeData, membros_familia_producao: newMembros })}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>7.2. Há mão de obra que não seja da família?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup row name="ha_mao_de_obra_nao_familiar" value={String(safeData.ha_mao_de_obra_nao_familiar ?? 'false')} onChange={handleChange}>
                            <FormControlLabel value="true" control={<Radio />} label="Sim" />
                            <FormControlLabel value="false" control={<Radio />} label="Não" />
                        </RadioGroup>
                        {safeData.ha_mao_de_obra_nao_familiar === true && (
                            <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                                <TextField label="Quantas pessoas?" name="quantidade_mao_de_obra" type="number" value={safeData.quantidade_mao_de_obra || ''} onChange={handleChange} sx={{ mb: 2, maxWidth: '200px' }} />
                                <CheckboxGroupMUI
                                    title="Qual a relação trabalhista?"
                                    options={['Trabalhador temporário', 'Trabalhador permanente', 'Parceria']}
                                    selectedString={safeData.relacao_trabalhista}
                                    onSelectionChange={(newValue) => handleCheckboxChange('relacao_trabalhista', newValue)}
                                />
                            </Box>
                        )}
                    </FormControl>
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>7.3. Incentiva e promove atividades educativas envolvendo família e/ou funcionário?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <CheckboxGroupMUI
                        title="Se sim, qual(is)?"
                        options={['Incentivo à escolarização', 'Cursos', 'Outras. Quais?']}
                        selectedString={safeData.incentivo_atividades_educativas}
                        onSelectionChange={(newValue) => handleCheckboxChange('incentivo_atividades_educativas', newValue)}
                        otherOption="Outras. Quais?"
                        otherValue={safeData.incentivo_atividades_outros}
                        onOtherChange={handleChange}
                        otherName="incentivo_atividades_outros"
                        otherPlaceholder="Especifique as outras atividades..."
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 'bold' }}>7.4. Como se relaciona com outros produtores e com as atividades culturais?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <CheckboxGroupMUI
                        title=""
                        options={['Participa de associação de produção ou associação comunitária.', 'Participa de atividades que valorizam a cultura local.', 'Promove atividades culturais que valorizam a cultura local.']}
                        selectedString={safeData.relacionamento_outros_produtores}
                        onSelectionChange={(newValue) => handleCheckboxChange('relacionamento_outros_produtores', newValue)}
                    />
                </AccordionDetails>
            </Accordion>

        </SectionShell>
    );
};

export default Secao7MUI;
