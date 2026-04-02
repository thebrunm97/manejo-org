import React from 'react';
import QRCode from 'react-qr-code';
import { 
    X, 
    Printer, 
    ExternalLink,
    ShieldCheck
} from 'lucide-react';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    publicUrl: string;
    cultura: string;
    codigoLote?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ 
    isOpen, 
    onClose, 
    publicUrl, 
    cultura,
    codigoLote 
}) => {
    if (!isOpen) return null;

    const shareUrl = publicUrl;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-w-none print:w-full">
                
                {/* Header (Hidden on Print) */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-tight">Etiqueta de Rastreabilidade</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {codigoLote}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content / Print Area */}
                <div className="p-8 flex flex-col items-center text-center print:p-0">
                    
                    {/* Print Only Header */}
                    <div className="hidden print:flex flex-col items-center mb-8 w-full border-b-2 border-slate-900 pb-4">
                        <h1 className="text-2xl font-black uppercase tracking-tighter">Manejo Orgânico Inteligente</h1>
                        <p className="text-sm font-bold">Rastreabilidade Garantida</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[2rem] mb-6 print:bg-transparent print:p-0">
                        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 print:shadow-none print:border-none">
                            <QRCode 
                                value={shareUrl} 
                                size={200}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 mb-8 w-full">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{cultura}</h2>
                        <div className="flex items-center justify-center gap-2">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase">Certificação Ativa</span>
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase">Lote: {codigoLote}</span>
                        </div>
                    </div>

                    {/* Print Context Only Text */}
                    <div className="hidden print:block text-center mt-4 border-t border-slate-200 pt-4 w-full">
                        <p className="text-[10px] font-medium text-slate-500 max-w-[200px] mx-auto italic leading-tight">
                            Aponte a câmera do seu celular para ver a história completa deste produto.
                        </p>
                    </div>

                    {/* Actions (Hidden on Print) */}
                    <div className="grid grid-cols-2 gap-3 w-full print:hidden">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                        >
                            <Printer size={18} /> Imprimir
                        </button>
                        <a 
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-sm transition-all active:scale-95"
                        >
                            <ExternalLink size={18} /> Ver Página
                        </a>
                    </div>
                </div>

                {/* Footer Insight (Hidden on Print) */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 print:hidden text-center">
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">
                        O QR Code acima redireciona para a página pública de auditoria da sua colheita.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
