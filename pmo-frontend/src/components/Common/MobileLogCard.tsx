import React from 'react';
import { Card, Box, Stack, Chip, Typography, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import { CadernoEntry } from '../../types/CadernoTypes';
import { formatDateBR, formatComplianceMessage } from '../../utils/formatters';
import { AlertTriangle } from 'lucide-react';

// Interface for component props
interface MobileLogCardProps {
    reg: CadernoEntry;
    onEdit?: (reg: CadernoEntry) => void;
    onDelete?: (reg: CadernoEntry) => void;
}

// Type for activity chip colors
type ChipColor = 'warning' | 'info' | 'success' | 'primary' | 'error' | 'default';

const getStatusColor = (tipo: string | undefined): ChipColor => {
    const map: Record<string, ChipColor> = {
        'Insumo': 'warning',
        'Manejo': 'info',
        'Plantio': 'success',
        'Colheita': 'primary',
        'CANCELADO': 'error',
        'Outro': 'default'
    };
    return map[tipo || ''] || 'default';
};

const MobileLogCard: React.FC<MobileLogCardProps> = ({ reg, onEdit, onDelete }) => {
    const isCancelado = reg.tipo_atividade === 'CANCELADO';
    const details = reg.detalhes_tecnicos as Record<string, any> || {};
    const historico = details.historico_alteracoes || [];
    const ultimaJustificativa = historico.length > 0 ? historico[historico.length - 1].motivo : null;

    // Helper: Check if value is valid (not empty, not "NÃO INFORMADO")
    const isValidValue = (val: string | number | undefined | null): boolean => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'string') {
            return val.trim() !== '' && val !== 'NÃO INFORMADO';
        }
        return true;
    };

    // Helper: Format quantity display
    const formatQuantidade = (): string => {
        const valor = reg.quantidade_valor;
        const unidade = reg.quantidade_unidade;

        if (!valor || Number(valor) <= 0) return '';

        const valorStr = String(valor);
        const unidadeStr = isValidValue(unidade) ? ` ${unidade}` : '';

        return `${valorStr}${unidadeStr}`;
    };

    return (
        <Card
            elevation={2}
            sx={{
                mb: 2,
                borderRadius: 3,
                overflow: 'visible',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                opacity: isCancelado ? 0.7 : 1,
                overflow: 'visible'
            }}
        >
            <Box sx={{ p: 2 }}>
                {/* HEADER: Tipo e Data */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Chip
                        label={reg.tipo_atividade || 'Atividade'}
                        size="small"
                        color={getStatusColor(reg.tipo_atividade)}
                        variant={isCancelado ? "outlined" : "filled"}
                        sx={{ fontWeight: 800, fontSize: '0.7rem', height: 24 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {formatDateBR(reg.data_registro)}
                    </Typography>
                </Stack>

                {/* BODY: Produto e Local */}
                <Box sx={{ mb: 1.5 }}>
                    {isValidValue(reg.produto) && (
                        <Typography
                            variant="subtitle1"
                            fontWeight={800}
                            color={isCancelado ? 'text.secondary' : 'text.primary'}
                            sx={{
                                lineHeight: 1.3,
                                mb: 0.5,
                                fontSize: '1.05rem',
                                textDecoration: isCancelado ? 'line-through' : 'none'
                            }}
                        >
                            {reg.produto}
                        </Typography>
                    )}

                    {isValidValue(reg.talhao_canteiro) && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.85rem' }}
                            >
                                📍 {reg.talhao_canteiro}
                            </Typography>
                        </Stack>
                    )}

                    {/* Detalhes Técnicos (Receita/Obs) */}
                    {(details.receita || reg.observacao_original) && (
                        <>
                            {formatComplianceMessage(reg.observacao_original) ? (
                                <div className="relative flex items-center group cursor-pointer mt-2 w-fit">
                                    <div className="flex items-center gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                                        <span className="font-bold">Ver Alerta de Compliance</span>
                                    </div>

                                    {/* Tooltip Overlay */}
                                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block group-active:block w-72 p-4 text-sm text-amber-900 bg-white border border-amber-200 rounded-lg shadow-2xl z-50 pointer-events-none">
                                        <div className="absolute top-full left-6 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                                        <p className="font-bold mb-1 uppercase tracking-widest text-[10px] text-amber-600">Alerta de Compliance</p>
                                        {formatComplianceMessage(reg.observacao_original)}
                                    </div>
                                </div>
                            ) : (
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{ mt: 1, display: 'block', fontStyle: 'italic', lineHeight: 1.2 }}
                                >
                                    "{details.receita || reg.observacao_original}"
                                </Typography>
                            )}
                        </>
                    )}

                    {isCancelado && ultimaJustificativa && (
                        <Typography
                            variant="caption"
                            color="error"
                            sx={{ mt: 1, display: 'block', fontWeight: 'bold' }}
                        >
                            MOTIVO: {ultimaJustificativa}
                        </Typography>
                    )}
                </Box>
            </Box>

            <Divider />

            {/* FOOTER: Quantidade e Ações */}
            <Box sx={{ p: 1, pl: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ fontSize: '0.95rem' }}>
                    {formatQuantidade()}
                </Typography>

                <Stack direction="row" spacing={1}>
                    {onEdit && onDelete && !isCancelado ? (
                        <>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center p-2 text-indigo-700 transition-colors bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => onEdit(reg)}
                            >
                                <EditIcon fontSize="small" />
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center p-2 text-red-700 transition-colors bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => onDelete(reg)}
                            >
                                <DeleteIcon fontSize="small" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center p-2 text-gray-400 bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed opacity-50"
                        >
                            <HistoryIcon fontSize="small" />
                        </button>
                    )}
                </Stack>
            </Box>
        </Card>
    );
};

export default MobileLogCard;
