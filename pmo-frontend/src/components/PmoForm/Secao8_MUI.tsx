// src/components/PmoForm/Secao8_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, TextField, Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import SectionShell from '../Plan/SectionShell';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';
import SuggestionReviewDialog from './SuggestionReviewDialog';
import { logFeedback } from '../../services/pmoService';
import GroupedInsumosList from './GroupedInsumosList_MUI';

// Types
interface Secao8Data {
    insumos_melhorar_fertilidade?: any[];
    insumos_producao_nao_organica?: { insumos_producao_nao_organica?: string };
    controle_insumos_producao_paralela?: { controle_insumos_producao_paralela?: string };
    [key: string]: any;
}

interface Secao8MUIProps {
    data: Secao8Data | null | undefined;
    formData?: { insumos_melhorar_fertilidade?: any[] };
    onSectionChange: (data: Secao8Data) => void;
}

const Secao8MUI: React.FC<Secao8MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const insumosFertilidade = safeData.insumos_melhorar_fertilidade || [];

    // Debug para verificar atualização
    React.useEffect(() => {
        console.log('🔄 Secao8 Update:', insumosFertilidade.length, 'items');
    }, [insumosFertilidade]);

    // State for Suggestion Review
    const [reviewOpen, setReviewOpen] = React.useState(false);
    const [pendingSuggestion, setPendingSuggestion] = React.useState<any>(null);
    const [pendingSuggestionRemove, setPendingSuggestionRemove] = React.useState<(() => void) | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onSectionChange({
            ...safeData,
            [name]: { [name]: value }
        });
    };

    const columnsInsumosFertilidade: TableColumn[] = [
        { id: 'produto_ou_manejo', label: 'Produto ou Manejo', type: 'text' },
        { id: 'onde', label: 'Onde (em que cultura)', type: 'text' },
        { id: 'quando', label: 'Quando?', type: 'text' },
        { id: 'procedencia', label: 'Procedência Interna/Externa', type: 'text' },
        { id: 'composicao', label: 'Composição', type: 'text' },
        { id: 'marca', label: 'Marca', type: 'text' },
        {
            id: 'dose_valor',
            label: 'Dose',
            type: 'number',
            width: '180px',
            unitSelector: {
                key: 'dose_unidade',
                options: ['kg', 'g', 'L', 'ml', 'ton', 'unid', 'sc', 'kg/ha', 'L/ha', 'm³/ha', 'g/m²', 'L/m²', 'ml/m²', 'm³/m²', 'kg/cova']
            }
        },
    ];

    const handleApplySuggestion = (suggestion: any, onRemove?: () => void) => {
        console.log('🤖 Reviewing suggestion for Section 8 with callback:', suggestion);

        // Estratégia de Extração Robusta (Raiz vs Atividades)
        const mainActivity = suggestion.atividades?.[0] || {};

        const detalhes = suggestion.detalhes_tecnicos || {};

        // 1. Identificar Produto
        // Prioriza: Raiz > Detalhes.Insumo > Atividade > Fallback
        const produto = suggestion.produto || detalhes.insumo || mainActivity.produto || 'Insumo Automático';

        // 2. Identificar Dose e Unidade
        // Prioriza: Raiz > Atividade > Parse de quantidade
        let valor = suggestion.dose_valor || mainActivity.dose_valor;
        let unidade = suggestion.dose_unidade || mainActivity.dose_unidade;

        // Fallback: Tenta extrair de 'quantidade' se dose não definida
        const rawQtd = suggestion.quantidade || mainActivity.quantidade;

        // Regex patterns
        const regexVal = /(\d+(\.\d+)?)/;
        const regexUnitArea = /(litros?|l\b|ml\b|g\b|gramas?|kg\b|kilos?|m3\b|m³)\s*(por|\/)\s*(m2|m²|metro\s*quadrado|ha|hectare|cova|planta)/i;
        const regexUnitL = /(litros?|l\b|ml\b)/i;
        const regexUnitKg = /(kilos?|kg\b|g\b|ton)/i;

        // Helper para inferir unidade com prioridade
        const inferUnidade = (valUnidade: string | undefined, rawQtd: any, desc: string): string => {
            // 1. Prioridade Absoluta: Backend já normalizou
            if (valUnidade) return valUnidade;

            const textToScan = `${rawQtd || ''} ${desc || ''}`.toLowerCase();

            // 2. Prioridade: Unidades Compostas (ex: L/m²)
            const matchArea = textToScan.match(regexUnitArea);
            if (matchArea) {
                // Normaliza retorno para formato padrão
                let un = matchArea[0].replace(/\s+por\s+/i, '/').replace(/\s+/g, '');
                // Map basic variations
                if (un.includes('metroquadrado')) un = un.replace('metroquadrado', 'm²');
                if (un.includes('m2')) un = un.replace('m2', 'm²');

                // Final Polish
                if (un.startsWith('litro')) un = un.replace('litros', 'L').replace('litro', 'L');
                if (un.startsWith('l/')) un = un.replace('l/', 'L/');
                return un;
            }

            // 3. Prioridade: Volume Simples
            if (regexUnitL.test(textToScan)) return 'L';

            // 4. Prioridade: Massa Simples
            if (regexUnitKg.test(textToScan)) return 'kg';

            // 5. Fallback Neutro (Deixa usuário escolher)
            return '';
        };

        if (!valor && rawQtd) {
            // Tenta achar número (ex: "50 kg" -> 50)
            const match = String(rawQtd).match(regexVal);
            if (match) valor = parseFloat(match[0]);
        }

        // Inferência centralizada da unidade
        if (!unidade) {
            unidade = inferUnidade(unidade, rawQtd, suggestion.descricao || '');
        }

        // 3. Identificar Local/Cultura (Onde)
        // Prioriza: Cultura explicita (Backend) > Local > Fallback
        const culturaExplicita = suggestion.cultura || mainActivity.cultura;
        const localObj = suggestion.local || mainActivity.local;
        const localTexto = localObj?.talhao || localObj?.canteiro || suggestion.talhao_canteiro;

        const ondeTexto = culturaExplicita || localTexto || 'NÃO INFORMADO';

        // 4. Identificar Quando (Momento/Fase)
        // Prioriza: Fase explicita (Backend) > Regex na descrição > Data
        let quandoTexto = suggestion.fase || mainActivity.fase || suggestion.quando;

        if (!quandoTexto) {
            const contextText = (suggestion.descricao || suggestion.observacoes || "").toLowerCase();
            if (contextText.includes("plantio") || contextText.includes("plantar")) quandoTexto = "Plantio";
            else if (contextText.includes("cobertura")) quandoTexto = "Cobertura";
            else if (contextText.includes("preparo") || contextText.includes("solo")) quandoTexto = "Preparo de Solo";
            else if (contextText.includes("pulveriza")) quandoTexto = "Pulverização";
            else if (contextText.includes("semeio") || contextText.includes("semeadura")) quandoTexto = "Semeadura";
            else quandoTexto = suggestion.data_registro || new Date().toISOString().split('T')[0];
        }

        const mappedData = {
            id: `row_${Date.now()}`,
            produto_ou_manejo: produto,
            onde: ondeTexto,
            quando: quandoTexto,
            procedencia: suggestion.procedencia || 'Externa',
            composicao: 'Não informada',
            marca: 'Não informada',
            dose_valor: valor,
            dose_unidade: unidade,
            _log_id: suggestion._log_id // Persistência do ID para feedback loop
        };

        setPendingSuggestion(mappedData);
        setPendingSuggestionRemove(() => onRemove || null);
        setReviewOpen(true);
    };


    const handleConfirmReview = (finalData: any) => {
        // Force new array reference to ensure re-render
        console.log('✅ Confirming review. Adding item:', finalData);

        const newItems = [...(insumosFertilidade || []), finalData];

        onSectionChange({
            ...safeData,
            insumos_melhorar_fertilidade: newItems
        });

        // =================================================================
        // ML FEEDBACK LOOP (FECHAMENTO PROATIVO)
        // =================================================================
        // Se este item veio de uma sugestão do Robô (tem _log_id),
        // registramos a versão final como "Ground Truth" para treino.
        if (finalData._log_id && pendingSuggestion) {
            // Removemos a chave interna antes de salvar/comparar
            const { _log_id, ...cleanFinal } = finalData;

            // Check simples de edição (Deep compare seria ideal, mas JSON stringify serve)
            // Precisamos comparar com o que o robô mandou ORIGINALMENTE (pendingSuggestion).
            // Mas pendingSuggestion já foi processado pelo handler.
            // O importante é: o usuário mudou o que estava no modal?
            // Vamos assumir True apenas se o usuário tiver alterado valores chave.

            // PendingSuggestion tem o estado inicial do modal.
            const { _log_id: lid, ...cleanInitial } = pendingSuggestion;

            const wasEdited = JSON.stringify(cleanFinal) !== JSON.stringify(cleanInitial);

            console.log(`🧠 ML Feedback: Log ${_log_id}, Editado: ${wasEdited}`);
            logFeedback(_log_id, cleanFinal, wasEdited); // Non-blocking
        }

        // Só remove se confirmar
        if (pendingSuggestionRemove) {
            console.log('🗑️ Removing processed suggestion');
            pendingSuggestionRemove();
        }

        setReviewOpen(false);
        setPendingSuggestion(null);
        setPendingSuggestionRemove(null);
    };

    return (
        <>
            <SectionShell
                sectionLabel="Seção 8"
                title="Insumos/Equipamentos"
                sectionId={8}
                onApplySuggestion={handleApplySuggestion}
            >

                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 'bold' }}>
                            8.1. Quais insumos/manejos são utilizados para melhorar a fertilidade do sistema orgânico?
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <GroupedInsumosList
                            data={insumosFertilidade}
                            onDataChange={(newData) => onSectionChange({ ...safeData, insumos_melhorar_fertilidade: newData })}
                        />
                    </AccordionDetails>
                </Accordion>

                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 'bold' }}>
                            8.2. Quais são os insumos utilizados na produção não orgânica?
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <TextField
                            name="insumos_producao_nao_organica"
                            value={safeData.insumos_producao_nao_organica?.insumos_producao_nao_organica || ''}
                            onChange={handleChange}
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={4}
                            placeholder="Descreva os insumos aqui..."
                        />
                    </AccordionDetails>
                </Accordion>

                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ fontWeight: 'bold' }}>
                            8.3. Nos casos de produção paralela, como são controlados os insumos e os equipamentos?
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <TextField
                            name="controle_insumos_producao_paralela"
                            value={safeData.controle_insumos_producao_paralela?.controle_insumos_producao_paralela || ''}
                            onChange={handleChange}
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={4}
                            placeholder="Descreva as medidas de controle aqui..."
                        />
                    </AccordionDetails>
                </Accordion>
            </SectionShell>

            <SuggestionReviewDialog
                open={reviewOpen}
                initialData={pendingSuggestion}
                columns={columnsInsumosFertilidade}
                onClose={() => setReviewOpen(false)}
                onConfirm={handleConfirmReview}
            />
        </>
    );
};

export default Secao8MUI;
