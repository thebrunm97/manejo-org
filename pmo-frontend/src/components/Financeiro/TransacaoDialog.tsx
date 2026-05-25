import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { getCategorias, registrarTransacaoPura, TransacaoPayload } from '../../services/financeiroService';
import { fetchAllPmos } from '../../services/pmoService';

interface Categoria {
    id: string;
    nome: string;
    tipo: 'RECEITA' | 'DESPESA';
}

interface TransacaoDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const TransacaoDialog: React.FC<TransacaoDialogProps> = ({ open, onClose, onSuccess }) => {
    const { currentPropriedade, user } = useAuth();
    
    const [tipo, setTipo] = useState<'DESPESA' | 'RECEITA'>('DESPESA');
    const [valorTotal, setValorTotal] = useState<string>('');
    const [categoriaId, setCategoriaId] = useState<string>('');
    const [fornecedor, setFornecedor] = useState<string>('');
    const [dataTransacao, setDataTransacao] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loadingCat, setLoadingCat] = useState(false);
    
    // Obter pmo ativo
    const [pmoId, setPmoId] = useState<number | undefined>();

    useEffect(() => {
        if (!open) return;

        const loadDeps = async () => {
            setLoadingCat(true);
            try {
                // 1. Carregar Categorias
                const resCat = await getCategorias();
                if (resCat.success && resCat.data) {
                    setCategorias(resCat.data as Categoria[]);
                }

                // 2. Carregar PMO Ativo
                if (currentPropriedade?.id) {
                    const resPmo = await fetchAllPmos(currentPropriedade.id);
                    if (resPmo.success && resPmo.data && resPmo.data.length > 0) {
                        const emAnd = resPmo.data.find(p => (p as any).status === 'Em andamento' || (p as any).status === 'em_andamento') || resPmo.data[0];
                        setPmoId(Number(emAnd.id));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingCat(false);
            }
        };

        loadDeps();
    }, [open, currentPropriedade]);

    // Reseta o form quando muda o tipo (para evitar enviar categoria errada)
    useEffect(() => {
        setCategoriaId('');
    }, [tipo]);

    const handleSave = async () => {
        if (!currentPropriedade?.id) {
            toast.error('Selecione uma propriedade primeiro.');
            return;
        }

        const valor = parseFloat(valorTotal.replace(',', '.'));
        if (isNaN(valor) || valor <= 0) {
            toast.warn('Preencha um valor válido maior que zero.');
            return;
        }

        if (!categoriaId) {
            toast.warn('Selecione uma categoria.');
            return;
        }

        if (!dataTransacao) {
            toast.warn('A data é obrigatória.');
            return;
        }

        setLoading(true);

        const payload: TransacaoPayload = {
            propriedade_id: currentPropriedade.id,
            tipo,
            valor_total: valor,
            categoria_id: categoriaId,
            fornecedor_cliente: fornecedor || undefined,
            user_id: user?.id,
            pmo_id: pmoId,
            data_competencia: dataTransacao
        };

        const res = await registrarTransacaoPura(payload);

        setLoading(false);

        if (res.success) {
            toast.success('Transação registrada com sucesso!');
            onSuccess(); // Triggers feed refresh
            handleClose();
        } else {
            toast.error(res.error || 'Erro ao registrar transação.');
        }
    };

    const handleClose = () => {
        setTipo('DESPESA');
        setValorTotal('');
        setCategoriaId('');
        setFornecedor('');
        setDataTransacao(new Date().toISOString().split('T')[0]);
        onClose();
    };

    if (!open) return null;

    const filteredCats = categorias.filter(c => c.tipo === tipo);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign size={24} className={tipo === 'RECEITA' ? 'text-emerald-500' : 'text-rose-500'} />
                        Nova Transação
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Tipo Selector */}
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setTipo('DESPESA')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                tipo === 'DESPESA' 
                                ? 'bg-white text-rose-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Saída (Despesa)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTipo('RECEITA')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                tipo === 'RECEITA' 
                                ? 'bg-white text-emerald-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Entrada (Receita)
                        </button>
                    </div>

                    {/* Valor */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor (R$)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className={`font-bold ${tipo === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>R$</span>
                            </div>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={valorTotal}
                                onChange={(e) => setValorTotal(e.target.value)}
                                className={`block w-full h-12 pl-12 pr-4 py-2 text-lg font-bold rounded-xl border focus:ring-4 transition-all ${
                                    tipo === 'RECEITA' 
                                    ? 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-emerald-700' 
                                    : 'border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 text-rose-700'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Categoria & Data */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Tag size={14} className="text-slate-400" />
                                Categoria
                            </label>
                            <select
                                value={categoriaId}
                                onChange={(e) => setCategoriaId(e.target.value)}
                                disabled={loadingCat}
                                className="block w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors bg-white disabled:bg-slate-50 disabled:text-slate-400"
                            >
                                <option value="" disabled>Selecione...</option>
                                {filteredCats.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Calendar size={14} className="text-slate-400" />
                                Data
                            </label>
                            <input
                                type="date"
                                value={dataTransacao}
                                onChange={(e) => setDataTransacao(e.target.value)}
                                className="block w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Fornecedor / Cliente */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <User size={14} className="text-slate-400" />
                            {tipo === 'DESPESA' ? 'Fornecedor' : 'Cliente / Origem'} <span className="text-slate-400 font-normal">(Opcional)</span>
                        </label>
                        <input
                            type="text"
                            placeholder={tipo === 'DESPESA' ? 'Ex: Loja Agrícola' : 'Ex: Feira Municipal'}
                            value={fornecedor}
                            onChange={(e) => setFornecedor(e.target.value)}
                            className="block w-full h-11 px-4 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 ${
                            tipo === 'RECEITA' 
                            ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-500/20' 
                            : 'bg-rose-600 hover:bg-rose-700 hover:shadow-md hover:shadow-rose-500/20'
                        }`}
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        Salvar Transação
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransacaoDialog;
