// src/components/PmoForm/Secao8.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { ChangeEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionShell from '../Plan/SectionShell';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';
import SuggestionReviewDialog from './SuggestionReviewDialog';
import { logFeedback } from '../../services/pmoService';
import GroupedInsumosList from './GroupedInsumosList';

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

// Accordion Panel helper
const AccordionPanel: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <span className="font-bold text-sm text-gray-800">{title}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="p-4">{children}</div>}
        </div>
    );
};

const Secao8MUI: React.FC<Secao8MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const insumosFertilidade = safeData.insumos_melhorar_fertilidade || [];

    // Debug para verificar atualização
    React.useEffect(() => {
        console.log('🔄 Secao8 Update:', insumosFertilidade.length, 'items');
    }, [insumosFertilidade]);

    // State for Suggestion Review
    const [reviewOpen, setReviewOpen] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<any>(null);
    const [pendingSuggestionRemove, setPendingSuggestionRemove] = useState<(() => void) | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

        const mainActivity = suggestion.atividades?.[0] || {};
        const detalhes = suggestion.detalhes_tecnicos || {};

        const produto = suggestion.produto || detalhes.insumo || mainActivity.produto || 'Insumo Automático';

        let valor = suggestion.dose_valor || mainActivity.dose_valor;
        let unidade = suggestion.dose_unidade || mainActivity.dose_unidade;

        const rawQtd = suggestion.quantidade || mainActivity.quantidade;

        const regexVal = /(\d+(\.\d+)?)/;
        const regexUnitArea = /(litros?|l\b|ml\b|g\b|gramas?|kg\b|kilos?|m3\b|m³)\s*(por|\/)\s*(m2|m²|metro\s*quadrado|ha|hectare|cova|planta)/i;
        const regexUnitL = /(litros?|l\b|ml\b)/i;
        const regexUnitKg = /(kilos?|kg\b|g\b|ton)/i;

        const inferUnidade = (valUnidade: string | undefined, rawQtd: any, desc: string): string => {
            if (valUnidade) return valUnidade;
            const textToScan = `${rawQtd || ''} ${desc || ''}`.toLowerCase();
            const matchArea = textToScan.match(regexUnitArea);
            if (matchArea) {
                let un = matchArea[0].replace(/\s+por\s+/i, '/').replace(/\s+/g, '');
                if (un.includes('metroquadrado')) un = un.replace('metroquadrado', 'm²');
                if (un.includes('m2')) un = un.replace('m2', 'm²');
                if (un.startsWith('litro')) un = un.replace('litros', 'L').replace('litro', 'L');
                if (un.startsWith('l/')) un = un.replace('l/', 'L/');
                return un;
            }
            if (regexUnitL.test(textToScan)) return 'L';
            if (regexUnitKg.test(textToScan)) return 'kg';
            return '';
        };

        if (!valor && rawQtd) {
            const match = String(rawQtd).match(regexVal);
            if (match) valor = parseFloat(match[0]);
        }

        if (!unidade) {
            unidade = inferUnidade(unidade, rawQtd, suggestion.descricao || '');
        }

        const culturaExplicita = suggestion.cultura || mainActivity.cultura;
        const localObj = suggestion.local || mainActivity.local;
        const localTexto = localObj?.talhao || localObj?.canteiro || suggestion.talhao_canteiro;
        const ondeTexto = culturaExplicita || localTexto || 'NÃO INFORMADO';

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
            _log_id: suggestion._log_id
        };

        setPendingSuggestion(mappedData);
        setPendingSuggestionRemove(() => onRemove || null);
        setReviewOpen(true);
    };


    const handleConfirmReview = (finalData: any) => {
        console.log('✅ Confirming review. Adding item:', finalData);
        const newItems = [...(insumosFertilidade || []), finalData];
        onSectionChange({ ...safeData, insumos_melhorar_fertilidade: newItems });

        if (finalData._log_id && pendingSuggestion) {
            const { _log_id, ...cleanFinal } = finalData;
            const { _log_id: lid, ...cleanInitial } = pendingSuggestion;
            const wasEdited = JSON.stringify(cleanFinal) !== JSON.stringify(cleanInitial);
            console.log(`🧠 ML Feedback: Log ${_log_id}, Editado: ${wasEdited}`);
            logFeedback(_log_id, cleanFinal, wasEdited);
        }

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
                <div className="flex flex-col gap-3">
                    <AccordionPanel title="8.1. Quais insumos/manejos são utilizados para melhorar a fertilidade do sistema orgânico?" defaultOpen>
                        <GroupedInsumosList
                            data={insumosFertilidade}
                            onDataChange={(newData) => onSectionChange({ ...safeData, insumos_melhorar_fertilidade: newData })}
                        />
                    </AccordionPanel>

                    <AccordionPanel title="8.2. Quais são os insumos utilizados na produção não orgânica?">
                        <textarea
                            name="insumos_producao_nao_organica"
                            value={safeData.insumos_producao_nao_organica?.insumos_producao_nao_organica || ''}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Descreva os insumos aqui..."
                            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-y"
                        />
                    </AccordionPanel>

                    <AccordionPanel title="8.3. Nos casos de produção paralela, como são controlados os insumos e os equipamentos?">
                        <textarea
                            name="controle_insumos_producao_paralela"
                            value={safeData.controle_insumos_producao_paralela?.controle_insumos_producao_paralela || ''}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Descreva as medidas de controle aqui..."
                            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-y"
                        />
                    </AccordionPanel>
                </div>
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
