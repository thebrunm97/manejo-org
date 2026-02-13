// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    name?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.group('🔥 ERROR BOUNDARY TRIGGERED');
        console.error('Boundary Name:', this.props.name || 'Root');
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('Component Stack:', errorInfo.componentStack);
        console.error('Full Error Object:', error);
        console.error('Full ErrorInfo Object:', errorInfo);
        console.groupEnd();

        this.setState({ error, errorInfo });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f1f5f9', p: 3 }}>
                    <Paper elevation={3} sx={{ maxWidth: 600, p: 4, textAlign: 'center', borderTop: '4px solid #ef4444' }}>
                        {this.props.name && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                                🎯 Erro capturado em: {this.props.name}
                            </Typography>
                        )}
                        <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: 16 }} />
                        <Typography variant="h5" fontWeight={700} color="#0f172a" gutterBottom>Ops! Algo deu errado</Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>A aplicação encontrou um erro inesperado. Por favor, recarregue a página.</Typography>

                        {this.state.error && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: '#fef2f2', borderRadius: 2, textAlign: 'left', maxHeight: 300, overflow: 'auto' }}>
                                <Typography variant="caption" fontWeight={600} color="#dc2626">Detalhes técnicos:</Typography>
                                <Typography variant="caption" component="pre" sx={{ mt: 1, fontSize: '0.75rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {this.state.error.toString()}
                                </Typography>
                                {this.state.errorInfo?.componentStack && (
                                    <>
                                        <Typography variant="caption" fontWeight={600} color="#dc2626" sx={{ display: 'block', mt: 2 }}>Component Stack:</Typography>
                                        <Typography variant="caption" component="pre" sx={{ mt: 1, fontSize: '0.7rem', color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {this.state.errorInfo.componentStack}
                                        </Typography>
                                    </>
                                )}
                            </Box>
                        )}

                        <Button variant="contained" onClick={() => window.location.reload()} sx={{ mt: 3, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}>
                            Recarregar Página
                        </Button>
                    </Paper>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
