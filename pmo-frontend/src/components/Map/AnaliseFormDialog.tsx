// src/components/Map/AnaliseFormDialog.tsx

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
    X,
    Beaker,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    Info,
    Loader2
} from 'lucide-react';
import { analiseService } from '../../services/analiseService';
import { soilLogic } from '../../utils/soilLogic';
import { cn } from '../../utils/cn';

// Types
interface AnaliseData {
    id?: string;
    data_analise?: string;
    ph?: string | number;
    ph_agua?: string | number;
    fosforo?: string | number;
    potassio?: string | number;
    calcio?: string | number;
    magnesio?: string | number;
    saturacao_bases?: string | number;
    materia_organica?: string | number;
    argila?: string | number;
    areia?: string | number;
    silte?: string | number;
}

interface AnaliseFormData {
    id?: string;
    data_analise: string;
    ph: string;
    fosforo: string;
    potassio: string;
    calcio: string;
    magnesio: string;
    saturacao_bases: string;
    materia_organica: string;
    argila: string;
    areia: string;
    silte: string | number;
}

interface AnaliseFormDialogProps {
    open: boolean;
    onClose: () => void;
    talhaoId: string;
    onSaveSuccess: () => void;
    initialData?: AnaliseData | null;
}

const AnaliseFormDialog: React.FC<AnaliseFormDialogProps> = ({ open, onClose, talhaoId, onSaveSuccess, initialData = null }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<AnaliseFormData>({
        data_analise: new Date().toISOString().split('T')[0],
        ph: '', fosforo: '', potassio: '', calcio: '', magnesio: '',
        saturacao_bases: '', materia_organica: '', argila: '', areia: '', silte: ''
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    id: initialData.id,
                    data_analise: String(initialData.data_analise || new Date().toISOString().split('T')[0]),
                    ph: String(initialData.ph || initialData.ph_agua || ''),
                    fosforo: String(initialData.fosforo || ''),
                    potassio: String(initialData.potassio || ''),
                    calcio: String(initialData.calcio || ''),
                    magnesio: String(initialData.magnesio || ''),
                    saturacao_bases: String(initialData.saturacao_bases || ''),
                    materia_organica: String(initialData.materia_organica || ''),
                    argila: String(initialData.argila || ''),
                    areia: String(initialData.areia || ''),
                    silte: String(initialData.silte || '')
                });
            } else {
                setFormData({
                    data_analise: new Date().toISOString().split('T')[0],
                    ph: '', fosforo: '', potassio: '', calcio: '', magnesio: '',
                    saturacao_bases: '', materia_organica: '', argila: '', areia: '', silte: ''
                });
            }
        }
    }, [initialData, open]);

    useEffect(() => {
        const argila = formData.argila;
        const areia = formData.areia;
        if (argila !== '' || areia !== '') {
            const calculatedSilte = soilLogic.calculateSilt(argila, areia);
            setFormData(prev => {
                if (parseFloat(String(prev.silte)) === calculatedSilte) return prev;
                return { ...prev, silte: calculatedSilte };
            });
        }
    }, [formData.argila, formData.areia]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isTextureInvalid = (): boolean => {
        const argila = parseFloat(formData.argila) || 0;
        const areia = parseFloat(formData.areia) || 0;
        return (argila + areia) > 100;
    };

    const handleSubmit = async () => {
        if (isTextureInvalid()) return;
        setLoading(true);
        try {
            const payload = { ...formData, talhao_id: talhaoId, ph: formData.ph, saturacao_bases: formData.saturacao_bases };
            await analiseService.saveAnalise(payload);
            onSaveSuccess();
            onClose();
        } catch (error) {
            alert('Erro ao salvar análise.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <Beaker size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {initialData ? 'Editar Análise de Solo' : 'Nova Análise de Solo'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="space-y-6">
                        {/* Data */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Calendar size={14} />
                                Data da Análise
                            </label>
                            <input
                                type="date"
                                name="data_analise"
                                value={formData.data_analise}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-slate-700"
                            />
                        </div>

                        {/* Química Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-widest px-2 py-0.5 bg-green-50 border border-green-100 rounded">Química do Solo</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">pH (H₂O)</label>
                                    <input
                                        type="number"
                                        name="ph"
                                        value={formData.ph}
                                        onChange={handleChange}
                                        placeholder="7.0"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">M.O. (%)</label>
                                    <input
                                        type="number"
                                        name="materia_organica"
                                        value={formData.materia_organica}
                                        onChange={handleChange}
                                        placeholder="2.5"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">P (mg/dm³)</label>
                                    <input
                                        type="number"
                                        name="fosforo"
                                        value={formData.fosforo}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">K (mg/dm³)</label>
                                    <input
                                        type="number"
                                        name="potassio"
                                        value={formData.potassio}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Ca (cmol)</label>
                                    <input
                                        type="number"
                                        name="calcio"
                                        value={formData.calcio}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Mg (cmol)</label>
                                    <input
                                        type="number"
                                        name="magnesio"
                                        value={formData.magnesio}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">V (%) (Sat. Bases)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="saturacao_bases"
                                            value={formData.saturacao_bases}
                                            onChange={handleChange}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all pr-7"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Física Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest px-2 py-0.5 bg-amber-50 border border-amber-100 rounded">Física (Textura)</span>
                            </div>

                            {isTextureInvalid() && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
                                    <AlertTriangle size={18} />
                                    <span className="text-xs font-semibold">A soma de Argila e Areia não pode exceder 100%</span>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">Argila (%)</label>
                                    <input
                                        type="number"
                                        name="argila"
                                        value={formData.argila}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">Areia (%)</label>
                                    <input
                                        type="number"
                                        name="areia"
                                        value={formData.areia}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 ml-1">Silte (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="silte"
                                            value={formData.silte}
                                            readOnly
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
                                        />
                                        <div className="absolute -bottom-4 right-0 leading-none">
                                            <span className="text-[9px] text-slate-400 font-medium">Auto-calculado</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || isTextureInvalid()}
                        className={cn(
                            "px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-green-900/10 transition-all flex items-center gap-2",
                            (loading || isTextureInvalid()) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {loading ? 'Salvando...' : 'Salvar Análise'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnaliseFormDialog;
