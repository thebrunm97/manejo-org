import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Button, Stack, Typography, Box } from '@mui/material';
import { SmartToy as BotIcon, Add as AddIcon, Close as IgnoreIcon } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { fetchPlanningSuggestions, markSuggestionAsProcessed } from '../../services/pmoService';

interface BotSuggestionsPanelProps {
    sectionId: number;
    onApply: (data: any, onRemove?: () => void) => void;
}

const BotSuggestionsPanel: React.FC<BotSuggestionsPanelProps> = ({ sectionId, onApply }) => {
    const { user } = useAuth();
    const [suggestions, setSuggestions] = useState<any[]>([]);

    // Load suggestions on mount
    useEffect(() => {
        console.log("[BOT-DEBUG] Buscando para o usuário:", user?.id, "| sectionId:", sectionId);
        if (user?.id) {
            fetchPlanningSuggestions(user.id).then(res => {
                if (res.success && res.data) {
                    console.log('BotSuggestions raw:', res.data); // Debug log

                    // Filter matching section
                    const relevant = res.data.filter(s => {
                        try {
                            const json = s.json_extraido || s.dados_extraidos; // Fallback
                            const data = typeof json === 'string' ? JSON.parse(json) : json;

                            console.log('Checking suggestion:', data);

                            // 1. Exact Match (if bot provided section)
                            if (data?.secao_pmo) {
                                return Number(data.secao_pmo) === Number(sectionId);
                            }

                            // 2. Heuristic for Section 10 (Fitossanidade)
                            // If no section provided, check for fitossanidade specific keys
                            if (sectionId === 10) {
                                const isFitossanidade =
                                    !!data?.alvo_praga_doenca ||
                                    !!data?.alvo_principal ||
                                    (!!data?.produto && !!data?.dose_valor); // Maybe product + dose without target?

                                return isFitossanidade;
                            }

                            // 3. Fallback: If generic planning, maybe show? 
                            // For now, default to false to avoid noise.
                            return false;
                        } catch (e) {
                            console.error('Error parsing suggestion JSON:', e);
                            return false;
                        }
                    });

                    console.log('Relevant suggestions:', relevant);
                    setSuggestions(relevant);
                } else {
                    console.error('Failed to fetch suggestions:', res.error);
                }
            });
        }
    }, [user, sectionId]);

    const handleIgnore = async (id: string) => {
        await markSuggestionAsProcessed(id);
        setSuggestions(prev => prev.filter(s => s.id !== id));
    };

    const handleApplyWrapper = async (suggestion: any) => {
        const json = suggestion.json_extraido || suggestion.dados_extraidos;
        const data = typeof json === 'string' ? JSON.parse(json) : json;

        // Injetar ID do log para rastreamento (Fechamento do Loop)
        const dataWithLogId = {
            ...data,
            _log_id: suggestion.id
        };

        // Passamos o callback de remoção para o pai decidir quando chamar (ex: após confirmar modal)
        onApply(dataWithLogId, () => handleIgnore(suggestion.id));
    };

    if (suggestions.length === 0) return null;

    return (
        <Stack spacing={2} sx={{ mb: 3 }}>
            {suggestions.map((s) => {
                const json = s.json_extraido || s.dados_extraidos;
                const data = typeof json === 'string' ? JSON.parse(json) : json;
                const hasAlert = !!data.alerta_conformidade;

                return (
                    <Alert
                        key={s.id}
                        icon={<BotIcon fontSize="inherit" />}
                        severity={hasAlert ? "warning" : "info"}
                        action={
                            <Stack direction="row" spacing={1}>
                                <Button size="small" color="inherit" onClick={() => handleIgnore(s.id)}>
                                    Ignorar
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color={hasAlert ? "warning" : "primary"}
                                    startIcon={<AddIcon />}
                                    onClick={() => handleApplyWrapper(s)}
                                >
                                    Adicionar à Tabela
                                </Button>
                            </Stack>
                        }
                        sx={{ alignItems: 'center' }}
                    >
                        <AlertTitle>Sugestão do Assistente de Voz</AlertTitle>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 0.5 }}>
                            "{s.texto_usuario}"
                        </Typography>
                        {hasAlert && (
                            <Box sx={{ mt: 1, fontWeight: 'bold' }}>
                                ⚠️ {data.alerta_conformidade}
                            </Box>
                        )}
                        {!hasAlert && (
                            <Typography variant="caption" display="block">
                                Extraído: {data.produto} {data.dose_valor ? `(${data.dose_valor} ${data.dose_unidade})` : ''}
                            </Typography>
                        )}
                    </Alert>
                );
            })}
        </Stack>
    );
};

export default BotSuggestionsPanel;
