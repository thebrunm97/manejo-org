// src/components/PmoForm/Secao12_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, FormControl,
    RadioGroup, FormControlLabel, Radio, Typography, TextField, Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import SectionShell from '../Plan/SectionShell';
import CheckboxGroupMUI from './CheckboxGroup_MUI';

interface AcondicionamentoData {
    embalados_envasados_produtos?: string;
    embalados_envasados_descricao?: string;
    granel_produtos?: string;
    granel_descricao?: string;
}

interface Secao12Data {
    higienizacao_produtos_organicos?: { higienizacao_produtos_organicos?: string };
    ha_processamento_producao_organica?: boolean;
    descricao_processamento_producao_organica?: { descricao_processamento_producao_organica?: string };
    ha_processamento_producao_paralela?: boolean;
    descricao_processamento_producao_paralela?: { descricao_processamento_producao_paralela?: string };
    higienizacao_equipamentos_instalacoes?: { higienizacao_equipamentos_instalacoes?: string };
    acondicionamento_produtos?: AcondicionamentoData;
    produtos_sao_rotulados?: boolean;
    descricao_rotulagem?: { descricao_rotulagem?: string };
    procedimentos_armazenamento?: string;
    procedimentos_armazenamento_outros?: string;
    controle_pragas_instalacoes?: { controle_pragas_instalacoes?: string };
    transporte_produtos_organicos?: { transporte_produtos_organicos?: string };
    [key: string]: any;
}

interface Secao12MUIProps {
    data: Secao12Data | null | undefined;
    onSectionChange: (data: Secao12Data) => void;
}

const AcondicionamentoProdutos: React.FC<{ data: AcondicionamentoData | undefined; onAcondicionamentoChange: (e: ChangeEvent<HTMLInputElement>) => void }> = ({ data, onAcondicionamentoChange }) => (
    <Box>
        <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>EMBALADOS/ENVASADOS</Typography>
                <TextField name="embalados_envasados_produtos" label="Cite quais produtos" value={data?.embalados_envasados_produtos || ''} onChange={onAcondicionamentoChange} fullWidth multiline rows={2} variant="outlined" margin="dense" />
                <TextField name="embalados_envasados_descricao" label="Descreva o procedimento" value={data?.embalados_envasados_descricao || ''} onChange={onAcondicionamentoChange} fullWidth multiline rows={2} variant="outlined" margin="dense" />
            </Grid>
            <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>A GRANEL</Typography>
                <TextField name="granel_produtos" label="Cite quais produtos" value={data?.granel_produtos || ''} onChange={onAcondicionamentoChange} fullWidth multiline rows={2} variant="outlined" margin="dense" />
                <TextField name="granel_descricao" label="Descreva a identificação/separação" value={data?.granel_descricao || ''} onChange={onAcondicionamentoChange} fullWidth multiline rows={2} variant="outlined" margin="dense" />
            </Grid>
        </Grid>
    </Box>
);

const Secao12MUI: React.FC<Secao12MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const camposAninhados = ['higienizacao_produtos_organicos', 'descricao_processamento_producao_organica', 'descricao_processamento_producao_paralela', 'higienizacao_equipamentos_instalacoes', 'descricao_rotulagem', 'controle_pragas_instalacoes', 'transporte_produtos_organicos'];

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue: string | boolean = value;
        if (name.startsWith('ha_') || name === 'produtos_sao_rotulados') finalValue = value === 'true';
        if (camposAninhados.includes(name)) {
            onSectionChange({ ...safeData, [name]: { [name]: finalValue as string } });
        } else {
            onSectionChange({ ...safeData, [name]: finalValue });
        }
    };

    const handleCheckboxChange = (fieldName: string, newValue: string) => onSectionChange({ ...safeData, [fieldName]: newValue });
    const handleAcondicionamentoChange = (e: ChangeEvent<HTMLInputElement>) => onSectionChange({ ...safeData, acondicionamento_produtos: { ...(safeData.acondicionamento_produtos || {}), [e.target.name]: e.target.value } });

    return (
        <SectionShell sectionLabel="Seção 12" title="Pós-Colheita, Processamento e Transporte">
            <Accordion defaultExpanded><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.1. Higienização dos produtos orgânicos</Typography></AccordionSummary><AccordionDetails><TextField name="higienizacao_produtos_organicos" value={safeData.higienizacao_produtos_organicos?.higienizacao_produtos_organicos || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.2. Processamento na produção orgânica?</Typography></AccordionSummary><AccordionDetails><FormControl component="fieldset" fullWidth><RadioGroup row name="ha_processamento_producao_organica" value={String(safeData.ha_processamento_producao_organica ?? 'false')} onChange={handleChange}><FormControlLabel value="true" control={<Radio />} label="Sim" /><FormControlLabel value="false" control={<Radio />} label="Não" /></RadioGroup>{safeData.ha_processamento_producao_organica && <TextField label="Descreva" name="descricao_processamento_producao_organica" value={safeData.descricao_processamento_producao_organica?.descricao_processamento_producao_organica || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" margin="normal" />}</FormControl></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.3. Processamento paralela (não orgânica)?</Typography></AccordionSummary><AccordionDetails><FormControl component="fieldset" fullWidth><RadioGroup row name="ha_processamento_producao_paralela" value={String(safeData.ha_processamento_producao_paralela ?? 'false')} onChange={handleChange}><FormControlLabel value="true" control={<Radio />} label="Sim" /><FormControlLabel value="false" control={<Radio />} label="Não" /></RadioGroup>{safeData.ha_processamento_producao_paralela && <TextField label="Descreva" name="descricao_processamento_producao_paralela" value={safeData.descricao_processamento_producao_paralela?.descricao_processamento_producao_paralela || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" margin="normal" />}</FormControl></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.4. Higienização de equipamentos</Typography></AccordionSummary><AccordionDetails><TextField name="higienizacao_equipamentos_instalacoes" value={safeData.higienizacao_equipamentos_instalacoes?.higienizacao_equipamentos_instalacoes || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.5. Acondicionamento dos produtos</Typography></AccordionSummary><AccordionDetails><AcondicionamentoProdutos data={safeData.acondicionamento_produtos} onAcondicionamentoChange={handleAcondicionamentoChange} /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.6. Produtos são rotulados?</Typography></AccordionSummary><AccordionDetails><FormControl component="fieldset" fullWidth><RadioGroup row name="produtos_sao_rotulados" value={String(safeData.produtos_sao_rotulados ?? 'false')} onChange={handleChange}><FormControlLabel value="true" control={<Radio />} label="Sim" /><FormControlLabel value="false" control={<Radio />} label="Não" /></RadioGroup>{safeData.produtos_sao_rotulados && <TextField label="Descreva" name="descricao_rotulagem" value={safeData.descricao_rotulagem?.descricao_rotulagem || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" margin="normal" />}</FormControl></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.7. Procedimentos de armazenamento</Typography></AccordionSummary><AccordionDetails><CheckboxGroupMUI title="" options={['Identificação clara de produtos orgânicos e não orgânicos', 'Local específico para armazenamento', 'Local limpo e higienizado', 'Equipamentos/embalagens adequados', 'Outros - citar:']} selectedString={safeData.procedimentos_armazenamento} onSelectionChange={(v) => handleCheckboxChange('procedimentos_armazenamento', v)} otherOption="Outros - citar:" otherValue={safeData.procedimentos_armazenamento_outros} onOtherChange={handleChange} otherName="procedimentos_armazenamento_outros" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.8. Controle de pragas em instalações</Typography></AccordionSummary><AccordionDetails><TextField name="controle_pragas_instalacoes" value={safeData.controle_pragas_instalacoes?.controle_pragas_instalacoes || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>12.9. Transporte dos produtos orgânicos</Typography></AccordionSummary><AccordionDetails><TextField name="transporte_produtos_organicos" value={safeData.transporte_produtos_organicos?.transporte_produtos_organicos || ''} onChange={handleChange} fullWidth multiline rows={3} variant="outlined" /></AccordionDetails></Accordion>
        </SectionShell>
    );
};

export default Secao12MUI;
