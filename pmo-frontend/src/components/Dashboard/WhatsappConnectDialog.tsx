// src/components/Dashboard/WhatsappConnectDialog.tsx
/**
 * Dialog for generating and displaying WhatsApp connection codes.
 */

import React, { useState, useEffect } from 'react';
import {
    MessageCircle,
    Copy,
    Check,
    RefreshCw,
    X,
    ExternalLink,
    Loader2,
    AlertCircle
} from 'lucide-react';
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

    // Reset state on open change
    useEffect(() => {
        if (!open) {
            setCode(null);
            setError(null);
            setCopied(false);
        }
    }, [open]);

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
        if (code && onSuccess) {
            onSuccess();
        }
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-50 rounded-2xl flex items-center justify-center">
                            <MessageCircle size={24} className="text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            Conectar WhatsApp
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {!code ? (
                        <div className="text-center">
                            <p className="text-slate-500 mb-8 leading-relaxed">
                                Gere um código de conexão para vincular seu WhatsApp ao sistema.
                                <br />
                                <span className="font-bold text-slate-700">O código expira após o uso.</span>
                            </p>

                            <button
                                onClick={handleGenerateCode}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-green-600/20 transition-all active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        Gerar Código de Conexão
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">
                                Envie este código via WhatsApp:
                            </p>

                            {/* Code Display */}
                            <div className="relative group mb-8">
                                <div className="p-8 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-[2rem] flex items-center justify-center gap-4 group-hover:border-emerald-300 transition-colors">
                                    <span className="text-4xl md:text-5xl font-mono font-black tracking-[0.4em] text-emerald-600 selection:bg-emerald-200">
                                        {code}
                                    </span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className={`absolute -right-2 -top-2 p-3 shadow-lg rounded-full transition-all active:scale-90 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50'
                                        }`}
                                    title={copied ? 'Copiado!' : 'Copiar código'}
                                >
                                    {copied ? <Check size={24} /> : <Copy size={24} />}
                                </button>
                            </div>

                            {/* Send to WhatsApp Button */}
                            {botNumber ? (
                                <div className="space-y-4">
                                    <a
                                        href={`https://wa.me/${botNumber}?text=CONECTAR%20${code}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 transition-all active:scale-95"
                                    >
                                        <ExternalLink size={20} />
                                        Enviar para o WhatsApp
                                    </a>
                                    <p className="text-xs font-medium text-slate-400">
                                        Será enviado: <span className="text-slate-600 font-bold tracking-wide">CONECTAR {code}</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-sm">
                                    Número do bot não configurado. Entre em contato com o suporte.
                                </div>
                            )}

                            {/* Regenerate Button */}
                            <button
                                onClick={handleGenerateCode}
                                disabled={loading}
                                className="mt-8 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-2"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                Gerar novo código
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        {code ? 'Fechar' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsappConnectDialog;
