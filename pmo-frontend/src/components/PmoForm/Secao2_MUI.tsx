import React, { useCallback, useState } from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Typography
} from '@mui/material';
import { useParams } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TabelaDinamica, { TableColumn, TableRowBase } from './TabelaDinamica';
import GroupedVegetalList from './GroupedVegetalList_MUI';
import Secao2RecordDetailsDialog, {
    Secao2ItemType,
} from './Secao2RecordDetailsDialog';

import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import BotSuggestionsPanel from './BotSuggestionsPanel';
import SuggestionRefinementDialog from './SuggestionRefinementDialog';
import { saveRefinedSuggestion } from '../../services/pmoService';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

export interface VegetalItem extends TableRowBase {
    produto?: string;
    talhoes_canteiros?: string | { _display?: string; talhao_nome?: string; area_m2?: number; talhao_id?: string; canteiro_id?: string; canteiro_nome?: string };
    area_plantada?: number;
    area_plantada_unidade?: string;
    producao_esperada_ano?: number;
    producao_unidade?: string;
}

export interface AnimalItem extends TableRowBase {
    especie?: string;
    n_de_animais?: number;
    area_externa?: number;
    area_interna_instalacoes?: number;
    exploracao?: string;
    estagio_de_vida?: string;
    media_de_peso_vivo?: number;
    producao_esperada_ano?: number | string; // Some legacy fields might rely on text
    producao_unidade?: string;
}

export interface AgroindItem extends TableRowBase {
    produto?: string;
    frequencia_producao?: string;
    epoca_producao?: string;
    producao_esperada_ano?: number;
    producao_unidade?: string;
}

export interface Secao2Data {
    producao_primaria_vegetal?: {
        produtos_primaria_vegetal: VegetalItem[];
    };
    producao_primaria_animal?: {
        animais_primaria_animal: AnimalItem[];
    };
    processamento_produtos_origem_vegetal?: {
        produtos_processamento_vegetal: AgroindItem[];
    };
    processamento_produtos_origem_animal?: {
        produtos_processamento_animal: AgroindItem[];
    };
    propriedade_id?: number;
}

export interface Secao2Props {
    data: Secao2Data;
    onSectionChange: (newData: Secao2Data) => void;
}

// ==================================================================
// ||                     COMPONENT DEFINITION                     ||
// ==================================================================

const Secao2MUI: React.FC<Secao2Props> = ({ data, onSectionChange }) => {
    const { pmoId } = useParams<{ pmoId: string }>();
    const safeData: Secao2Data = data || {};

    // --- STATES PARA DIALOG DE DETALHES ---
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<VegetalItem | AnimalItem | AgroindItem | null>(null);
    const [selectedType, setSelectedType] = useState<Secao2ItemType>('VEGETAL');

    // --- STATE REFINAMENTO BOT ---
    const [refinementOpen, setRefinementOpen] = useState(false);
    const [refinementData, setRefinementData] = useState<any>(null);
    const [refinementCallback, setRefinementCallback] = useState<(() => void) | null>(null);

    // --- HANDLERS DE VISUALIZAÇÃO ---
    // Nota: handleViewVegetal removido - novo componente GroupedVegetalList gerencia edição inline

    const handleViewAnimal = (item: AnimalItem) => {
        setSelectedItem(item);
        setSelectedType('ANIMAL');
        setDetailsOpen(true);
    };

    const handleViewAgroindVeg = (item: AgroindItem) => {
        setSelectedItem(item);
        setSelectedType('AGROIND_VEG');
        setDetailsOpen(true);
    };

    const handleViewAgroindAni = (item: AgroindItem) => {
        setSelectedItem(item);
        setSelectedType('AGROIND_ANI');
        setDetailsOpen(true);
    };

    const handleVegetalChange = useCallback((newData: VegetalItem[]) => {
        onSectionChange({
            ...safeData,
            producao_primaria_vegetal: {
                ...safeData.producao_primaria_vegetal,
                produtos_primaria_vegetal: newData
            }
        });
    }, [onSectionChange, safeData]);

    const handleAnimalChange = useCallback((newData: AnimalItem[]) => {
        onSectionChange({
            ...safeData,
            producao_primaria_animal: {
                ...safeData.producao_primaria_animal,
                animais_primaria_animal: newData
            }
        });
    }, [onSectionChange, safeData]);

    const handleProcessamentoVegetalChange = useCallback((newData: AgroindItem[]) => {
        onSectionChange({
            ...safeData,
            processamento_produtos_origem_vegetal: {
                ...safeData.processamento_produtos_origem_vegetal,
                produtos_processamento_vegetal: newData
            }
        });
    }, [onSectionChange, safeData]);

    const handleProcessamentoAnimalChange = useCallback((newData: AgroindItem[]) => {
        onSectionChange({
            ...safeData,
            processamento_produtos_origem_animal: {
                ...safeData.processamento_produtos_origem_animal,
                produtos_processamento_animal: newData
            }
        });
    }, [onSectionChange, safeData]);


    // --- BOT SUGGESTION HANDLER (Section 2.1) ---
    const handleApplySuggestion = (botData: any, onRemove?: () => void) => {
        console.log("Opening Refinement for:", botData);
        setRefinementData(botData);
        setRefinementCallback(() => onRemove); // Store callback to remove from panel later
        setRefinementOpen(true);
    };

    const handleConfirmRefinement = async (finalData: any) => {
        const newItem: VegetalItem = {
            id: uuidv4(),
            produto: finalData.produto?.toUpperCase() || "NOVO CULTIVO",
            talhoes_canteiros: finalData.talhao_canteiro,
            area_plantada: Number(finalData.area_plantada) || 0,
            area_plantada_unidade: finalData.area_plantada_unidade || 'm²',
            producao_esperada_ano: Number(finalData.producao_esperada_ano) || 0,
            producao_unidade: finalData.producao_unidade || 'kg'
        };

        // 1. Atualizar UI
        const currentList = safeData.producao_primaria_vegetal?.produtos_primaria_vegetal || [];
        handleVegetalChange([...currentList, newItem]);

        // 2. Salvar Refinamento no Log (Feedback Loop)
        if (finalData._log_id) {
            await saveRefinedSuggestion(finalData._log_id, finalData);
        }

        // 3. Limpar painel
        if (refinementCallback) refinementCallback();

        toast.success(`Cultivo "${newItem.produto}" adicionado e refinamento salvo!`);
        setRefinementOpen(false);
        setRefinementData(null);
    };


    // --- COLUMN DEFINITIONS ---
    // Nota: columnsVegetal removido - agora usa GroupedVegetalList com layout próprio

    const columnsAnimal: TableColumn[] = [
        { id: 'especie', type: 'text', label: 'Espécie' },
        { id: 'n_de_animais', type: 'number', label: 'Nº de animais' },
        { id: 'area_externa', type: 'number', label: 'Área Externa' },
        { id: 'area_interna_instalacoes', type: 'number', label: 'Área Interna' },
        { id: 'exploracao', type: 'text', label: 'Exploração' },
        { id: 'estagio_de_vida', type: 'text', label: 'Estágio de Vida' },
        { id: 'media_de_peso_vivo', type: 'number', label: 'Média de Peso Vivo' },
        {
            id: 'producao_esperada_ano',
            type: 'text',
            label: 'Produção Esperada/Ano',
            unitSelector: { key: 'producao_unidade', options: ['kg', 'ton', 'L', 'dúzia'] }
        }
    ];

    const columnsProcessamento: TableColumn[] = [
        { id: 'produto', type: 'text', label: 'Produto' },
        { id: 'frequencia_producao', type: 'text', label: 'Frequência' },
        { id: 'epoca_producao', type: 'text', label: 'Época' },
        {
            id: 'producao_esperada_ano',
            type: 'number',
            label: 'Produção Esperada/Ano',
            unitSelector: { key: 'producao_unidade', options: ['kg', 'ton', 'L', 'potes'] }
        }
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                Seção 2: Atividades Produtivas Orgânicas
            </Typography>
            <Typography variant="body1" sx={{ mt: -2, mb: 1 }}>
                Detalhe as atividades produtivas orgânicas da propriedade.
            </Typography>

            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>2.1. Produção Primária Vegetal (PPV)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <BotSuggestionsPanel
                        sectionId={2}
                        onApply={handleApplySuggestion}
                    />
                    <GroupedVegetalList
                        data={safeData.producao_primaria_vegetal?.produtos_primaria_vegetal || []}
                        onDataChange={handleVegetalChange}
                        pmoId={pmoId}
                        propriedadeId={safeData.propriedade_id}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>2.2. Produção Primária Animal (PPA)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TabelaDinamica<AnimalItem>
                        columns={columnsAnimal}
                        data={safeData.producao_primaria_animal?.animais_primaria_animal || []}
                        onDataChange={handleAnimalChange}
                        itemName="Animal"
                        itemNoun="o"
                        onRowClick={handleViewAnimal}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>2.3. Processamento de Produtos de Origem Vegetal (PPOV)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TabelaDinamica<AgroindItem>
                        columns={columnsProcessamento}
                        data={safeData.processamento_produtos_origem_vegetal?.produtos_processamento_vegetal || []}
                        onDataChange={handleProcessamentoVegetalChange}
                        itemName="Produto Processado (Vegetal)"
                        itemNoun=""
                        onRowClick={handleViewAgroindVeg}
                    />
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>2.4. Processamento de Produtos de Origem Animal (PPOA)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TabelaDinamica<AgroindItem>
                        columns={columnsProcessamento}
                        data={safeData.processamento_produtos_origem_animal?.produtos_processamento_animal || []}
                        onDataChange={handleProcessamentoAnimalChange}
                        itemName="Produto Processado (Animal)"
                        itemNoun=""
                        onRowClick={handleViewAgroindAni}
                    />
                </AccordionDetails>
            </Accordion>
            <Secao2RecordDetailsDialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                item={selectedItem}
                type={selectedType}
            />

            <SuggestionRefinementDialog
                open={refinementOpen}
                initialData={refinementData}
                onClose={() => setRefinementOpen(false)}
                onConfirm={handleConfirmRefinement}
            />
        </Box>
    );
}

export default Secao2MUI;
