// src/components/Dashboard/WhatsappConnectDialog.tsx
/**
 * Dialog for generating and displaying WhatsApp connection codes.
 */

import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    IconButton,
    Tooltip
} from '@mui/material';
import { MessageCircle, Copy, Check, RefreshCw, X, ExternalLink } from 'lucide-react';
import { generateWhatsappCode, getWhatsappBotNumber } from '../../services/whatsappService';

interface WhatsappConnectDialogProps {
    open: boolean;
    onClose: () => void;
    userId: string;
    onSuccess?: () => void;
}

const WhatsappConnectDialog: React.FC<WhatsappConnectDialogProps> = ({
    open,
    onClose,
    userId,
    onSuccess
}) => {
    const [code, setCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const botNumber = getWhatsappBotNumber();

    const handleGenerateCode = async () => {
        setLoading(true);
        setError(null);
        setCopied(false);

        try {
            const generatedCode = await generateWhatsappCode(userId);
            setCode(generatedCode);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar código');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        // Reset state on close
        setCode(null);
        setError(null);
        setCopied(false);
        onClose();
        if (code && onSuccess) {
            onSuccess();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '20px',
                    p: 1
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ p: 1, bgcolor: '#dcfce7', borderRadius: '12px' }}>
                        <MessageCircle size={24} color="#16a34a" />
                    </Box>
                    <Typography variant="h6" fontWeight={700}>
                        Conectar WhatsApp
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error}
                    </Alert>
                )}

                {!code ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Gere um código de conexão para vincular seu WhatsApp ao sistema.
                            <br />
                            <strong>O código expira após o uso.</strong>
                        </Typography>

                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleGenerateCode}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshCw size={20} />}
                            sx={{
                                bgcolor: '#16a34a',
                                borderRadius: '12px',
                                px: 4,
                                py: 1.5,
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { bgcolor: '#15803d' }
                            }}
                        >
                            {loading ? 'Gerando...' : 'Gerar Código de Conexão'}
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Envie este código via WhatsApp:
                        </Typography>

                        {/* Code Display */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                p: 3,
                                bgcolor: '#f0fdf4',
                                borderRadius: '16px',
                                border: '2px dashed #86efac',
                                mb: 3
                            }}
                        >
                            <Typography
                                variant="h3"
                                sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    letterSpacing: '0.3em',
                                    color: '#16a34a'
                                }}
                            >
                                {code}
                            </Typography>
                            <Tooltip title={copied ? 'Copiado!' : 'Copiar código'}>
                                <IconButton
                                    onClick={handleCopyCode}
                                    sx={{
                                        bgcolor: copied ? '#dcfce7' : '#e2e8f0',
                                        '&:hover': { bgcolor: copied ? '#bbf7d0' : '#cbd5e1' }
                                    }}
                                >
                                    {copied ? <Check size={20} color="#16a34a" /> : <Copy size={20} />}
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Send to WhatsApp Button */}
                        {botNumber ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    href={`https://wa.me/${botNumber}?text=CONECTAR%20${code}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    startIcon={<ExternalLink size={20} />}
                                    sx={{
                                        bgcolor: '#25D366',
                                        borderRadius: '12px',
                                        px: 4,
                                        py: 1.5,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: '#128C7E' }
                                    }}
                                >
                                    Enviar para o WhatsApp
                                </Button>
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    Será enviado: <strong>CONECTAR {code}</strong>
                                </Typography>
                            </Box>
                        ) : (
                            <Alert severity="info" sx={{ borderRadius: '12px' }}>
                                Número do bot não configurado. Entre em contato com o suporte.
                            </Alert>
                        )}

                        {/* Regenerate Button */}
                        <Button
                            variant="text"
                            size="small"
                            onClick={handleGenerateCode}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
                            sx={{ mt: 2, textTransform: 'none', color: '#64748b' }}
                        >
                            Gerar novo código
                        </Button>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={handleClose}
                    sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        color: '#64748b'
                    }}
                >
                    {code ? 'Fechar' : 'Cancelar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default WhatsappConnectDialog;
