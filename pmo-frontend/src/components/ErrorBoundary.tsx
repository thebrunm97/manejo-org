// src/components/ErrorBoundary.tsx — Zero MUI
import React, { Component, ErrorInfo, ReactNode } from 'react';
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
                <div className="min-h-screen flex items-center justify-center bg-slate-100 p-3">
                    <div className="max-w-[600px] w-full bg-white rounded-lg shadow-lg border-t-4 border-red-500 p-6 text-center">
                        {this.props.name && (
                            <span className="block text-xs font-bold text-red-500 mb-1">
                                🎯 Erro capturado em: {this.props.name}
                            </span>
                        )}
                        <AlertTriangle size={64} color="#ef4444" className="mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h2>
                        <p className="text-gray-500 mb-4">A aplicação encontrou um erro inesperado. Por favor, recarregue a página.</p>

                        {this.state.error && (
                            <div className="mt-2 p-3 bg-red-50 rounded-lg text-left max-h-[300px] overflow-auto">
                                <span className="text-xs font-semibold text-red-600">Detalhes técnicos:</span>
                                <pre className="mt-1 text-xs text-red-900 whitespace-pre-wrap break-words">
                                    {this.state.error.toString()}
                                </pre>
                                {this.state.errorInfo?.componentStack && (
                                    <>
                                        <span className="block text-xs font-semibold text-red-600 mt-2">Component Stack:</span>
                                        <pre className="mt-1 text-[0.7rem] text-red-800 whitespace-pre-wrap break-words">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 px-5 py-2.5 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
                        >
                            Recarregar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
