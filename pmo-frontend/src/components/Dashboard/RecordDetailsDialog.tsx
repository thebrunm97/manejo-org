import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, Chip, Divider, Grid, Paper,
    Stack, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import SpaIcon from '@mui/icons-material/Spa';
import GrassIcon from '@mui/icons-material/Grass';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';

import { CadernoCampoRecord, DetalhesColheita, DetalhesManejo, DetalhesPlantio, AtividadeItemLite } from '../../types/CadernoTypes';

export interface RecordDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    record: CadernoCampoRecord | null;
}

// Fallback icon for Manejo if needed, or reuse one
const SprayCanIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h18v18H3z" stroke="none" />
        <path d="M12 2v4M8 6h8M8 10h8M12 10v6M9 16c-1.5 0-2 1.5-2 3v3h10v-3c0-1.5-.5-3-2-3" />
    </svg>
);

const getIconByType = (tipo: string) => {
    switch (tipo) {
        case 'colheita': return <AgricultureIcon />;
        case 'manejo': return <SprayCanIcon />;
        case 'insumo': return <Inventory2Icon />;
        case 'plantio': return <SpaIcon />;
        default: return <LocalFloristIcon />;
    }
};

const RecordDetailsDialog: React.FC<RecordDetailsDialogProps> = ({ open, onClose, record }) => {
    if (!record) return null;

    const rawTipo = record.tipo_atividade || 'Outro';
    const tipo = rawTipo.toLowerCase();
    const details = record.detalhes_tecnicos || {};

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Data desconhecida';
        try {
            // FIX: Prevent timezone shift for YYYY-MM-DD format
            // If date is just YYYY-MM-DD, append T12:00 to avoid midnight UTC issue
            let dateToFormat = dateString;
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                dateToFormat = `${dateString}T12:00:00`;
            }
            return new Date(dateToFormat).toLocaleDateString('pt-BR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Detectar se usa novo modelo (atividades array) ou campos legado
    const usarNovoModelo = record.atividades && record.atividades.length > 0;

    // Badge de sistema só para consórcio/SAF (não poluir com monocultura)
    const mostrarBadgeSistema = record.sistema && record.sistema !== 'monocultura';
    const getSistemaBadge = () => {
        if (!mostrarBadgeSistema) return null;
        const config = {
            consorcio: { label: 'CONSÓRCIO', color: '#3b82f6', bg: '#dbeafe' },
            saf: { label: 'SAF', color: '#16a34a', bg: '#dcfce7' }
        };
        const c = config[record.sistema as 'consorcio' | 'saf'];
        if (!c) return null;
        return (
            <Chip
                label={c.label}
                size="small"
                sx={{ fontWeight: 700, bgcolor: c.bg, color: c.color, ml: 1 }}
            />
        );
    };

    const locais = (record.caderno_campo_canteiros && record.caderno_campo_canteiros.length > 0)
        ? record.caderno_campo_canteiros.map(c => c.canteiros?.nome).filter(Boolean) as string[]
        : (record.talhao_canteiro || '').split(';').map(part => part.trim()).filter(Boolean);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    padding: 2,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        bgcolor: '#f1f5f9',
                        p: 1,
                        borderRadius: '12px',
                        color: '#0f172a',
                        display: 'flex'
                    }}>
                        {getIconByType(tipo)}
                    </Box>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                {rawTipo}
                            </Typography>
                            {getSistemaBadge()}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b' }}>
                            <EventIcon sx={{ fontSize: 16 }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {formatDate(record.data_registro)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#e2e8f0' } }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ borderColor: '#f1f5f9' }}>
                <Stack spacing={3}>

                    {/* SEÇÃO PRINCIPAL: PRODUTO & LOCAL */}
                    {usarNovoModelo ? (
                        // NOVO MODELO: Lista de atividades
                        <Stack spacing={2}>
                            {(record.atividades ?? []).map((item, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        bgcolor: '#f8fafc',
                                        p: 2,
                                        borderRadius: '16px',
                                        border: '1px solid #e2e8f0'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                            🌱 {item.produto && item.produto !== 'NÃO INFORMADO' ? item.produto : ''}
                                        </Typography>
                                        {item.papel && item.papel !== 'principal' && (
                                            <Chip
                                                label={item.papel.toUpperCase()}
                                                size="small"
                                                sx={{ fontSize: '0.7rem', height: 20, bgcolor: '#f1f5f9', color: '#64748b' }}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                                                Quantidade
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#15803d' }}>
                                                {item.quantidade}
                                                <Typography component="span" sx={{ fontSize: '0.8em', ml: 0.5, color: '#64748b' }}>
                                                    {item.unidade}
                                                </Typography>
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                                                Local
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <PlaceIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                                    {item.local.talhao}{item.local.canteiro ? `, ${item.local.canteiro}` : ''}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                    {item.estrato && (
                                        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#64748b', fontStyle: 'italic' }}>
                                            Estrato: {item.estrato}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    ) : (
                        // FALLBACK LEGADO: Campos únicos
                        <Box sx={{ bgcolor: '#f8fafc', p: 2.5, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            {/* Produto */}
                            <Box sx={{ mb: 2.5 }}>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>
                                    Produto / Cultura
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                                    {record.produto && record.produto !== 'NÃO INFORMADO' ? record.produto : ''}
                                </Typography>
                            </Box>

                            {/* Quantidade e Local lado a lado */}
                            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {(Number(record.quantidade_valor) > 0) && (
                                    <Box sx={{ minWidth: 120 }}>
                                        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>
                                            Quantidade
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#15803d', mt: 0.5 }}>
                                            {record.quantidade_valor}
                                            {record.quantidade_unidade && (
                                                <Typography component="span" sx={{ fontSize: '0.75em', ml: 0.5, color: '#64748b', fontWeight: 500 }}>
                                                    {record.quantidade_unidade}
                                                </Typography>
                                            )}
                                        </Typography>
                                    </Box>
                                )}

                                <Box sx={{ flex: 1, minWidth: 150 }}>
                                    <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>
                                        Local
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                                        <PlaceIcon sx={{ fontSize: 18, color: '#64748b', mt: 0.2 }} />
                                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#334155' }}>
                                            {locais.length === 0
                                                ? 'Geral / Não especificado'
                                                : locais.map((part, idx) => (
                                                    <React.Fragment key={idx}>
                                                        {idx > 0 && <br />}
                                                        {part}
                                                    </React.Fragment>
                                                ))}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* DETALHES ESPECÍFICOS */}
                    {Object.keys(details).length > 0 && (
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#0f172a' }}>
                                Detalhes da Atividade
                            </Typography>

                            <Grid container spacing={2}>
                                {tipo === 'colheita' && (() => {
                                    const d = details as DetalhesColheita;
                                    return (
                                        <>
                                            {d.lote && <DetailItem label="Lote" value={d.lote} />}
                                            {d.destino && <DetailItem label="Destino" value={d.destino} />}
                                            {d.classificacao && <DetailItem label="Classificação" value={d.classificacao} />}
                                            {Boolean(d.qtd) && d.qtd !== record.quantidade_valor && (
                                                <DetailItem label="Qtd. Extra" value={`${d.qtd} ${d.unidade || ''}`} />
                                            )}
                                        </>
                                    );
                                })()}

                                {(tipo === 'manejo' || tipo === 'insumo') && (() => {
                                    const d = details as DetalhesManejo;
                                    return (
                                        <>
                                            {(d.nome_insumo || d.insumo) && <DetailItem label="Insumo Aplicado" value={d.nome_insumo || d.insumo} colSpan={12} />}
                                            {Boolean(d.dosagem) && <DetailItem label="Dosagem" value={`${d.dosagem} ${d.unidade_dosagem || ''}`} />}
                                            {d.metodo_aplicacao && <DetailItem label="Método" value={d.metodo_aplicacao} />}
                                            {d.responsavel && <DetailItem label="Responsável" value={d.responsavel} />}
                                            {d.periodo_carencia && <DetailItem label="Carência" value={d.periodo_carencia} />}
                                        </>
                                    );
                                })()}

                                {tipo === 'plantio' && (() => {
                                    const d = details as DetalhesPlantio;
                                    return (
                                        <>
                                            {d.metodo_propagacao && <DetailItem label="Propagação" value={d.metodo_propagacao} />}
                                            {Boolean(d.qtd_utilizada) && <DetailItem label="Qtd. Sementes/Mudas" value={`${d.qtd_utilizada} ${d.unidade_medida}`} />}
                                            {Boolean(d.espacamento) && <DetailItem label="Espaçamento" value={d.espacamento} />}
                                            {d.lote_semente && <DetailItem label="Lote Semente" value={d.lote_semente} />}
                                        </>
                                    );
                                })()}

                                {!['colheita', 'manejo', 'insumo', 'plantio'].includes(tipo) && (
                                    <Grid item xs={12}>
                                        <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                                            {JSON.stringify(details, null, 2)}
                                        </Typography>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>
                    )}

                    {/* OBSERVAÇÕES */}
                    {record.observacao_original && (
                        <Box>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
                                Observações
                            </Typography>
                            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fffbed', border: '1px solid #fef3c7', borderRadius: '12px' }}>
                                <Typography variant="body2" sx={{ color: '#92400e', whiteSpace: 'pre-wrap' }}>
                                    {record.observacao_original}
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {/* ÁUDIO ORIGINAL (PROVA DE AUDITORIA) */}
                    {record.audio_url && (
                        <Box>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                🎙️ Áudio Original (Prova de Auditoria)
                            </Typography>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    bgcolor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}
                            >
                                <audio
                                    controls
                                    src={record.audio_url}
                                    preload="metadata"
                                    style={{ width: '100%' }}
                                />
                                <Typography variant="caption" sx={{ color: '#16a34a', fontStyle: 'italic' }}>
                                    Áudio enviado via WhatsApp e transcrito automaticamente
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                <Button
                    onClick={onClose}
                    variant="contained"
                    disableElevation
                    sx={{
                        bgcolor: '#0f172a',
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: '10px',
                        px: 3,
                        '&:hover': { bgcolor: '#1e293b' }
                    }}
                >
                    Fechar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// Helper Subcomponent for Grid Items
const DetailItem = ({ label, value, colSpan = 6 }: { label: string, value: any, colSpan?: number }) => {
    // Strict clean up: if value is 0, "0", or starts with "0 " (e.g. "0 kg"), treat as empty
    if (!value) return null;
    const strVal = String(value).trim();
    if (strVal === '0' || strVal === '0.0' || strVal.startsWith('0 ')) return null;

    return (
        <Grid item xs={colSpan}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block', mb: 0.5 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                {value}
            </Typography>
        </Grid>
    );
};

export default RecordDetailsDialog;
