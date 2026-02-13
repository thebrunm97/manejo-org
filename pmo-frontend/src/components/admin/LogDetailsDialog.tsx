import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Chip,
    IconButton,
    CircularProgress,
    Divider,
    Alert,
    Paper
} from '@mui/material';
import { X, User, MessageSquare, Database, DollarSign, Activity, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export interface LogData {
    id: string;
    user_id?: string;
    created_at?: string;
    criado_em?: string;
    // Consumption fields
    acao?: string;
    modelo_ia?: string;
    total_tokens?: number;
    custo_estimado?: number;
    duracao_ms?: number;
    status?: string;
    meta?: any;
    // Training/Content fields
    texto_usuario?: string;
    json_extraido?: any;
    json_corrigido?: any;
    tipo_atividade?: string;
    audio_url?: string;
}

interface LogDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    log: LogData | null;
}

interface UserProfile {
    nome?: string;
    email?: string;
    plan_tier?: string;
    role?: string;
}

const LogDetailsDialog: React.FC<LogDetailsDialogProps> = ({ open, onClose, log }) => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (open && log?.user_id) {
            fetchUserProfile(log.user_id);
        } else {
            setUserProfile(null);
            setFetchError(null);
        }
    }, [open, log]);

    const fetchUserProfile = async (userId: string) => {
        setLoadingProfile(true);
        setFetchError(null);
        try {
            // Use RPC to get email from auth.users + profile data
            const { data, error } = await supabase
                .rpc('get_admin_user_details', { target_user_id: userId });

            if (error) throw error;

            // RPC returns an array of rows
            if (data && data.length > 0) {
                setUserProfile(data[0]);
            } else {
                // Fallback for edge cases (e.g. user deleted from auth but profile exists?)
                setUserProfile({ nome: 'Usuário não encontrado', email: '-', plan_tier: '-', role: '-' });
            }
        } catch (err: any) {
            console.error('Error fetching user profile:', err);
            setFetchError(err.message || 'Erro desconhecido');
        } finally {
            setLoadingProfile(false);
        }
    };

    if (!log) return null;

    // Normalizing data
    const createdAtDates = log.created_at || log.criado_em;
    const dateObj = createdAtDates ? new Date(createdAtDates) : null;
    const formattedDate = dateObj
        ? dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';

    const messageContent = log.texto_usuario || (log as any).input_message || '';
    const jsonContent = log.json_corrigido || log.json_extraido || log.meta;
    // Note: 'meta' is used in logs_consumo, json_* in logs_treinamento

    const audioUrl = log.audio_url || (log.json_extraido as any)?.audio_url || (log.meta as any)?.audio_url;

    const hasMessageContent = !!messageContent || !!audioUrl;
    const hasJsonContent = jsonContent && Object.keys(jsonContent).length > 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8f9fa' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Activity size={20} className="text-blue-600" />
                    <Typography variant="h6" component="div">
                        Detalhes da Interação
                    </Typography>
                    <Chip
                        label={formattedDate}
                        size="small"
                        variant="outlined"
                        icon={<Clock size={14} />}
                        sx={{ ml: 2, bgcolor: 'white' }}
                    />
                </Box>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{ color: (theme) => theme.palette.grey[500] }}
                >
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* 1. SEÇÃO DE USUÁRIO */}
                    <Grid item xs={12}>
                        <Card variant="outlined" sx={{ bgcolor: '#f1f5f9' }}>
                            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ p: 1, bgcolor: 'white', borderRadius: '50%' }}>
                                            <User size={24} className="text-slate-500" />
                                        </Box>
                                        <Box>
                                            {loadingProfile ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {userProfile?.nome || 'Usuário Desconhecido'}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {userProfile?.email || log.user_id}
                                                    </Typography>
                                                    {fetchError && (
                                                        <Typography variant="caption" color="error" display="block">
                                                            Erro: {fetchError}
                                                        </Typography>
                                                    )}
                                                </>
                                            )}
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip
                                            label={userProfile?.plan_tier?.toUpperCase() || 'FREE'}
                                            color="primary"
                                            size="small"
                                            variant="filled"
                                        />
                                        {userProfile?.role === 'admin' && (
                                            <Chip label="ADMIN" color="error" size="small" />
                                        )}
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* 2. DADOS TÉCNICOS & JSON (Coluna Esquerda) */}
                    <Grid item xs={12} md={hasMessageContent ? 6 : 12}>
                        <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Database size={16} />
                            Metadados Técnicos
                        </Typography>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                            {log.modelo_ia && (
                                <Chip label={log.modelo_ia} size="small" variant="outlined" />
                            )}
                            {log.acao && (
                                <Chip label={`Ação: ${log.acao}`} size="small" color="secondary" variant="outlined" />
                            )}
                            {log.total_tokens !== undefined && (
                                <Chip label={`${log.total_tokens} Tokens`} size="small" icon={<Database size={12} />} />
                            )}
                            {log.custo_estimado !== undefined && (
                                <Chip label={`$${Number(log.custo_estimado).toFixed(6)}`} size="small" icon={<DollarSign size={12} />} color="error" variant="outlined" />
                            )}
                            {log.duracao_ms !== undefined && (
                                <Chip label={`${log.duracao_ms}ms`} size="small" variant="outlined" />
                            )}
                        </Box>

                        {hasJsonContent && (
                            <>
                                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                                    JSON Processado
                                </Typography>
                                <Box sx={{
                                    p: 2,
                                    bgcolor: '#1e293b',
                                    color: '#e2e8f0',
                                    borderRadius: 1,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    maxHeight: '400px',
                                    overflowY: 'auto',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {JSON.stringify(jsonContent || {}, null, 2)}
                                </Box>
                            </>
                        )}
                    </Grid>

                    {/* 3. CONTEÚDO DA MENSAGEM (Coluna Direita - Somente se houver conteúdo) */}
                    {hasMessageContent && (
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MessageSquare size={16} />
                                Conteúdo da Mensagem
                            </Typography>

                            {audioUrl && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                            src={audioUrl}
                                            style={{ width: '100%' }}
                                        />
                                        <Typography variant="caption" sx={{ color: '#16a34a', fontStyle: 'italic' }}>
                                            Áudio enviado via WhatsApp e transcrito automaticamente
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            {messageContent && (
                                <Box sx={{
                                    p: 2,
                                    bgcolor: '#eff6ff',
                                    borderRadius: 2,
                                    border: '1px solid #dbeafe',
                                    minHeight: audioUrl ? 100 : 200,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    <Typography variant="body1">
                                        {messageContent}
                                    </Typography>
                                </Box>
                            )}
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Fechar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LogDetailsDialog;
