// src/components/PmoForm/Secao13_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControl,
    RadioGroup, FormControlLabel, Radio, TextField, Typography, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, IconButton,
    useTheme, useMediaQuery, Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckboxGroupMUI from './CheckboxGroup_MUI';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

// Types
interface NutricaoItem {
    animal?: string;
    identificacao_ingrediente?: string;
    origem_transgenica?: boolean | null;
    descricao?: string;
    procedencia?: string;
    frequencia?: string;
    quantidade?: string;
}

interface AlimentoItem {
    alimento?: string;
    [key: string]: any; // Jan, Fev, Mar, etc.
}

interface Secao13Data {
    tecnicas_melhoria_pastos?: string;
    tecnicas_melhoria_pastos_outros?: string;
    reproducao_animais?: string;
    reproducao_animais_outros?: string;
    aquisicao_animais?: any;
    evolucao_plantel?: any[];
    nutricao_animal?: NutricaoItem[];
    plano_anual_alimentacao_animal?: AlimentoItem[];
    alimentacao_mamiferos_jovens?: { alimentacao_mamiferos_jovens?: string };
    bem_estar_animais?: string;
    bem_estar_animais_manejo_cama?: string;
    manejo_sanitario_animal?: any;
    [key: string]: any;
}

interface Secao13MUIProps {
    data: Secao13Data | null | undefined;
    onSectionChange: (data: Secao13Data) => void;
}

// Subcomponente: Tabela de Nutrição Animal
const TabelaNutricaoAnimalMUI: React.FC<{ data: NutricaoItem[] | undefined; onDataChange: (data: NutricaoItem[]) => void }> = ({ data, onDataChange }) => {
    const safeData = Array.isArray(data) ? data : [];
    const handleItemChange = (index: number, field: string, value: any) => { const newData = [...safeData]; newData[index] = { ...newData[index], [field]: value }; onDataChange(newData); };
    const adicionarItem = () => onDataChange([...safeData, { animal: '', identificacao_ingrediente: '', origem_transgenica: null, descricao: '', procedencia: '', frequencia: '', quantidade: '' }]);
    const removerItem = (index: number) => onDataChange(safeData.filter((_, i) => i !== index));

    return (
        <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>*Em caso de alimentação externa, informe se provém de sistema orgânico.</Typography>
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead><TableRow><TableCell>Animal</TableCell><TableCell>Ingrediente/Composição</TableCell><TableCell>Origem Transgênica?</TableCell><TableCell>Descrição</TableCell><TableCell>Procedência</TableCell><TableCell>Frequência</TableCell><TableCell>Quantidade</TableCell><TableCell align="center">Ação</TableCell></TableRow></TableHead>
                    <TableBody>
                        {safeData.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell><TextField variant="standard" fullWidth value={item.animal || ''} onChange={(e) => handleItemChange(index, 'animal', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={item.identificacao_ingrediente || ''} onChange={(e) => handleItemChange(index, 'identificacao_ingrediente', e.target.value)} /></TableCell>
                                <TableCell><Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}><Radio checked={item.origem_transgenica === true} onChange={() => handleItemChange(index, 'origem_transgenica', true)} size="small" /> Sim<Radio checked={item.origem_transgenica === false} onChange={() => handleItemChange(index, 'origem_transgenica', false)} size="small" /> Não</Box></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={item.descricao || ''} onChange={(e) => handleItemChange(index, 'descricao', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={item.procedencia || ''} onChange={(e) => handleItemChange(index, 'procedencia', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={item.frequencia || ''} onChange={(e) => handleItemChange(index, 'frequencia', e.target.value)} /></TableCell>
                                <TableCell><TextField variant="standard" fullWidth value={item.quantidade || ''} onChange={(e) => handleItemChange(index, 'quantidade', e.target.value)} /></TableCell>
                                <TableCell align="center"><IconButton onClick={() => removerItem(index)} color="error"><DeleteIcon /></IconButton></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Button startIcon={<AddCircleOutlineIcon />} onClick={adicionarItem} sx={{ mt: 2 }}>Adicionar Nutrição</Button>
        </Box>
    );
};

// Subcomponente: Plano Anual de Alimentação
const PlanoAnualAlimentacaoMUI: React.FC<{ data: AlimentoItem[] | undefined; onDataChange: (data: AlimentoItem[]) => void }> = ({ data, onDataChange }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const safeData = Array.isArray(data) ? data : [];
    const handleItemChange = (index: number, field: string, value: any) => { const newData = [...safeData]; newData[index] = { ...newData[index], [field]: value }; onDataChange(newData); };
    const adicionarAlimento = () => onDataChange([...safeData, { alimento: '', Jan: false, Fev: false, Mar: false, Abr: false, Mai: false, Jun: false, Jul: false, Ago: false, Set: false, Out: false, Nov: false, Dez: false }]);
    const removerAlimento = (index: number) => onDataChange(safeData.filter((_, i) => i !== index));

    if (isMobile) {
        return (
            <Box>
                {safeData.map((item, index) => (
                    <Paper key={index} elevation={2} sx={{ p: 2, mb: 2, position: 'relative' }}>
                        <TextField label="Alimento" variant="outlined" fullWidth size="small" value={item.alimento || ''} onChange={(e) => handleItemChange(index, 'alimento', e.target.value)} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>Marque os meses:</Typography>
                        <Grid container spacing={1} sx={{ mt: 0.5 }}>
                            {meses.map(mes => (<Grid item xs={4} key={mes}><FormControlLabel control={<Checkbox checked={item[mes] || false} onChange={(e) => handleItemChange(index, mes, e.target.checked)} />} label={mes} /></Grid>))}
                        </Grid>
                        <IconButton onClick={() => removerAlimento(index)} color="error" size="small" sx={{ position: 'absolute', top: 8, right: 8 }}><DeleteIcon /></IconButton>
                    </Paper>
                ))}
                <Button startIcon={<AddCircleOutlineIcon />} onClick={adicionarAlimento} sx={{ mt: 2 }}>Adicionar Alimento</Button>
            </Box>
        );
    }

    return (
        <Box>
            <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead><TableRow><TableCell sx={{ width: '25%', fontWeight: 'bold' }}>Alimento</TableCell>{meses.map(mes => <TableCell key={mes} align="center" sx={{ fontWeight: 'bold' }}>{mes}</TableCell>)}<TableCell align="center" sx={{ fontWeight: 'bold' }}>Ação</TableCell></TableRow></TableHead>
                    <TableBody>
                        {safeData.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell><TextField variant="standard" fullWidth value={item.alimento || ''} onChange={(e) => handleItemChange(index, 'alimento', e.target.value)} /></TableCell>
                                {meses.map(mes => (<TableCell key={mes} align="center"><Checkbox checked={item[mes] || false} onChange={(e) => handleItemChange(index, mes, e.target.checked)} /></TableCell>))}
                                <TableCell align="center"><IconButton onClick={() => removerAlimento(index)} color="error"><DeleteIcon /></IconButton></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Button startIcon={<AddCircleOutlineIcon />} onClick={adicionarAlimento} sx={{ mt: 2 }}>Adicionar Alimento</Button>
        </Box>
    );
};

// Componente Principal
const Secao13MUI: React.FC<Secao13MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => onSectionChange({ ...safeData, [e.target.name]: e.target.value });
    const handleCheckboxChange = (fieldName: string, newValue: string) => onSectionChange({ ...safeData, [fieldName]: newValue });
    const handleNestedChange = (e: ChangeEvent<HTMLInputElement>) => onSectionChange({ ...safeData, [e.target.name]: { [e.target.name]: e.target.value } });
    const handleManejoSanitarioChange = (e: ChangeEvent<HTMLInputElement>) => onSectionChange({ ...safeData, manejo_sanitario_animal: { ...safeData.manejo_sanitario_animal, [e.target.name]: { [e.target.name]: e.target.value } } });

    const colunasEvolucaoPlantel: TableColumn[] = [{ id: 'tipo_animal', label: 'Tipo de animal', type: 'text' }, { id: 'numero_atual', label: 'Nº atual', type: 'number' }, { id: 'em_1_ano', label: 'Em 1 ano', type: 'number' }, { id: 'em_3_anos', label: 'Em 3 anos', type: 'number' }, { id: 'em_5_anos', label: 'Em 5 anos', type: 'number' }];
    const colunasTratamentoAnimais: TableColumn[] = [{ id: 'animal_lote', label: 'Animal/Lote', type: 'text' }, { id: 'diagnostico', label: 'Diagnóstico', type: 'text' }, { id: 'tratamento', label: 'Tratamento', type: 'text' }, { id: 'periodo_carencia', label: 'Período de Carência', type: 'text' }];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 2, textAlign: 'left' }}>Seção 13: Produção Animal</Typography>

            <Accordion defaultExpanded><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.1. Técnicas para melhoria de pastos</Typography></AccordionSummary><AccordionDetails><CheckboxGroupMUI title="" options={['Pastejo rotacionado', 'Consorciação de pastagens', 'Rotação de culturas', 'Adubação orgânica', 'Uso de quebra-vento', 'Plantio de árvores nativas', 'Integração lavoura/pecuária', 'Outros - citar:']} selectedString={safeData.tecnicas_melhoria_pastos} onSelectionChange={(v) => handleCheckboxChange('tecnicas_melhoria_pastos', v)} otherOption="Outros - citar:" otherValue={safeData.tecnicas_melhoria_pastos_outros} onOtherChange={handleChange} otherName="tecnicas_melhoria_pastos_outros" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.2. Como realiza a reprodução?</Typography></AccordionSummary><AccordionDetails><CheckboxGroupMUI title="" options={['Compra animais de fora', 'Monta natural', 'Métodos artificiais', 'Outros - citar:']} selectedString={safeData.reproducao_animais} onSelectionChange={(v) => handleCheckboxChange('reproducao_animais', v)} otherOption="Outros - citar:" otherValue={safeData.reproducao_animais_outros} onOtherChange={handleChange} otherName="reproducao_animais_outros" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.4. Evolução do plantel</Typography></AccordionSummary><AccordionDetails><TabelaDinamica columns={colunasEvolucaoPlantel} data={safeData.evolucao_plantel} onDataChange={(newData) => onSectionChange({ ...safeData, evolucao_plantel: newData })} itemName="Tipo de Animal" /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.5. Nutrição animal</Typography></AccordionSummary><AccordionDetails><TabelaNutricaoAnimalMUI data={safeData.nutricao_animal} onDataChange={(newData) => onSectionChange({ ...safeData, nutricao_animal: newData })} /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.6. Plano anual de alimentação</Typography></AccordionSummary><AccordionDetails><PlanoAnualAlimentacaoMUI data={safeData.plano_anual_alimentacao_animal} onDataChange={(newData) => onSectionChange({ ...safeData, plano_anual_alimentacao_animal: newData })} /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.7. Alimentação de mamíferos jovens</Typography></AccordionSummary><AccordionDetails><TextField name="alimentacao_mamiferos_jovens" fullWidth multiline rows={3} value={safeData.alimentacao_mamiferos_jovens?.alimentacao_mamiferos_jovens || ''} onChange={handleNestedChange} /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.8. Bem-estar dos animais</Typography></AccordionSummary><AccordionDetails><CheckboxGroupMUI title="" options={['Manejo adequado', 'Água de boa qualidade', 'Alimento farto', 'Instalações adequadas', 'Lotação adequada', 'Sombreamento']} selectedString={safeData.bem_estar_animais} onSelectionChange={(v) => handleCheckboxChange('bem_estar_animais', v)} /></AccordionDetails></Accordion>

            <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 'bold' }}>13.9. Manejo sanitário animal</Typography></AccordionSummary><AccordionDetails><Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}><TextField label="13.9.1. Promoção da saúde animal" name="promocao_saude_animal" fullWidth multiline rows={3} value={safeData.manejo_sanitario_animal?.promocao_saude_animal?.promocao_saude_animal || ''} onChange={handleManejoSanitarioChange} /><TextField label="13.9.2. Controle de vermes e parasitas" name="controle_vermes_parasitas" fullWidth multiline rows={3} value={safeData.manejo_sanitario_animal?.controle_vermes_parasitas?.controle_vermes_parasitas || ''} onChange={handleManejoSanitarioChange} /><TabelaDinamica label="13.9.3. Tratamentos realizados" columns={colunasTratamentoAnimais} data={safeData.manejo_sanitario_animal?.tratamento_animais_doentes} onDataChange={(newData) => onSectionChange({ ...safeData, manejo_sanitario_animal: { ...safeData.manejo_sanitario_animal, tratamento_animais_doentes: newData } })} itemName="Tratamento" itemNoun="o" /></Box></AccordionDetails></Accordion>
        </Box>
    );
};

export default Secao13MUI;
