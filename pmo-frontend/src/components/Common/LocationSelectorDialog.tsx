import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormGroup, FormControlLabel, Checkbox, CircularProgress, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { supabase } from '../../supabaseClient';

interface LocationSelectorProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (locais: string[]) => void;
    pmoId: number;
    initialSelected?: string[]; // ✅ NOVA PROP: Recebe os canteiros já salvos
}

interface CanteiroDB {
    nome: string;
}

interface TalhaoDB {
    nome: string;
    canteiros: CanteiroDB[];
}

const LocationSelectorDialog: React.FC<LocationSelectorProps> = ({
    open,
    onClose,
    onConfirm,
    pmoId,
    initialSelected = [] // ✅ Valor padrão
}) => {
    const [loading, setLoading] = useState(false);
    const [talhoes, setTalhoes] = useState<{ nome: string; canteiros: string[] }[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // ✅ EFEITO DE HIDRATAÇÃO: Carrega os dados e define a seleção inicial
    useEffect(() => {
        if (open) {
            // Carrega os dados do banco
            if (pmoId) fetchLocais();

            // Define o que já estava marcado (se houver)
            // Filtra duplicados e valores nulos/vazios
            const validSelection = (initialSelected || []).filter(Boolean);
            setSelected(validSelection);
        }
    }, [open, pmoId]); // Removemos initialSelected do array de dependências para evitar loop se o pai recriar o array

    const fetchLocais = async () => {
        setLoading(true);
        setErrorMsg(null);
        const agrupado: Record<string, string[]> = {};

        try {
            // 1. BUSCA ESTRUTURAL (A Verdade Física)
            const { data, error } = await supabase
                .from('talhoes')
                .select(`
                  nome,
                  canteiros ( nome )
                `);

            if (error) throw error;

            const infraData = data as unknown as TalhaoDB[];

            if (infraData) {
                infraData.forEach((talhao) => {
                    const nomeTalhao = talhao.nome || 'Sem Nome';
                    agrupado[nomeTalhao] = [];

                    if (talhao.canteiros && talhao.canteiros.length > 0) {
                        talhao.canteiros.forEach((c) => {
                            agrupado[nomeTalhao].push(c.nome);
                        });
                    } else {
                        agrupado[nomeTalhao].push('Área Total');
                    }
                });
            }

            // 2. BUSCA LEGADA
            const { data: pmoData } = await supabase
                .from('pmo_culturas')
                .select('localizacao')
                .eq('pmo_id', pmoId);

            if (pmoData) {
                pmoData.forEach((item: any) => {
                    const loc = item.localizacao;
                    if (typeof loc === 'string' && !loc.startsWith('{') && !loc.startsWith('[')) {
                        let encontrou = false;
                        Object.keys(agrupado).forEach(t => {
                            if (loc.includes(t)) encontrou = true;
                        });
                        if (!encontrou) {
                            if (!agrupado['Locais Legados']) agrupado['Locais Legados'] = [];
                            if (!agrupado['Locais Legados'].includes(loc)) agrupado['Locais Legados'].push(loc);
                        }
                    }
                });
            }

            // Ordenação
            Object.keys(agrupado).forEach(key => {
                agrupado[key].sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.replace(/\D/g, '')) || 0;
                    return numA - numB || a.localeCompare(b);
                });
            });

            setTalhoes(Object.entries(agrupado).map(([nome, canteiros]) => ({ nome, canteiros })));

        } catch (error) {
            console.error("Erro ao buscar locais:", error);
            setErrorMsg("Falha ao carregar infraestrutura. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (fullPath: string, simpleName: string) => {
        // Lógica Híbrida:
        // Se o usuário clicar, salvamos o fullPath (melhor para o futuro),
        // mas precisamos saber se estamos removendo algo que era apenas "simpleName" antes.

        const isSelected = selected.includes(fullPath) || selected.includes(simpleName);

        if (isSelected) {
            // Remove tanto o path completo quanto o nome simples para limpar
            setSelected(prev => prev.filter(p => p !== fullPath && p !== simpleName));
        } else {
            // Adiciona o path completo
            setSelected(prev => [...prev, fullPath]);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Selecionar Locais de Plantio</DialogTitle>
            <DialogContent dividers>
                {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />}

                {errorMsg && (
                    <Typography color="error" sx={{ p: 2, textAlign: 'center' }}>
                        {errorMsg}
                    </Typography>
                )}

                {!loading && !errorMsg && talhoes.map((t, i) => (
                    <Accordion key={i} defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography fontWeight="bold">{t.nome}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <FormGroup>
                                {t.canteiros.map((c: string) => {
                                    const path = `${t.nome} > ${c}`;
                                    // ✅ CHECK INTELIGENTE: Verifica se está selecionado pelo Caminho Completo OU pelo Nome Simples (legado/banco)
                                    const isChecked = selected.includes(path) || selected.includes(c);

                                    return (
                                        <FormControlLabel
                                            key={c}
                                            control={
                                                <Checkbox
                                                    checked={isChecked}
                                                    onChange={() => handleToggle(path, c)}
                                                />
                                            }
                                            label={c}
                                        />
                                    );
                                })}
                            </FormGroup>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={() => { onConfirm(selected); onClose(); }}>
                    Confirmar ({selected.length})
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LocationSelectorDialog;