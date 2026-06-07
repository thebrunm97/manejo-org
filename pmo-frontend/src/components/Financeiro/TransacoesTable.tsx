import React, { useState } from 'react';
import { TransacaoFinanceira } from '../../domain/financeiro/financeiroTypes';
import { Search, Filter, AlertCircle } from 'lucide-react';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(d);
};

interface TransacoesTableProps {
    transacoes: TransacaoFinanceira[];
    loading: boolean;
}

const TransacoesTable: React.FC<TransacoesTableProps> = ({ transacoes, loading }) => {
    const [filtroTipo, setFiltroTipo] = useState<'ALL' | 'RECEITA' | 'DESPESA'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTransacoes = transacoes.filter((t) => {
        // Filter by type
        if (filtroTipo !== 'ALL' && t.tipo !== filtroTipo) return false;
        
        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const categoryMatch = t.categoria_nome?.toLowerCase().includes(term);
            const providerMatch = t.fornecedor?.toLowerCase().includes(term);
            if (!categoryMatch && !providerMatch) return false;
        }

        return true;
    });

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-bold text-slate-800 text-lg">Histórico de Transações</h3>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar fornecedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                        />
                    </div>
                    
                    <div className="relative w-full sm:w-auto flex items-center">
                        <Filter size={16} className="text-slate-400 absolute left-3" />
                        <select
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value as any)}
                            className="block w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 appearance-none bg-white transition-colors cursor-pointer"
                        >
                            <option value="ALL">Todos os Tipos</option>
                            <option value="RECEITA">Receitas</option>
                            <option value="DESPESA">Despesas</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <th className="p-4 pl-6 whitespace-nowrap">Data</th>
                            <th className="p-4 whitespace-nowrap">Categoria</th>
                            <th className="p-4 whitespace-nowrap">Fornecedor / Origem</th>
                            <th className="p-4 whitespace-nowrap text-right pr-6">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                        <span className="text-sm font-medium text-slate-500">Carregando transações...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredTransacoes.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <div className="p-3 bg-slate-50 rounded-full mb-3">
                                            <AlertCircle size={24} className="text-slate-300" />
                                        </div>
                                        <p className="font-medium text-slate-600">Nenhuma transação encontrada</p>
                                        <p className="text-sm mt-1">Nenhum registro corresponde aos filtros atuais.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTransacoes.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 pl-6 whitespace-nowrap text-sm text-slate-600 font-medium">
                                        {formatDate(t.data_transacao)}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                                                {t.categoria_nome}
                                            </span>
                                            {t.talhao_canteiro && (
                                                <span 
                                                    title={t.talhao_canteiro.split(';').map(s => s.trim()).filter(Boolean).join(', ')}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-[150px] truncate cursor-help"
                                                >
                                                    {t.talhao_canteiro.split(';').map(s => s.trim()).filter(Boolean).join(', ')}
                                                </span>
                                            )}
                                            {!t.talhao_canteiro && t.alocacoes && t.alocacoes.length === 1 && t.alocacoes[0].talhao_nome !== 'Global' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                    {t.alocacoes[0].talhao_nome}
                                                </span>
                                            )}
                                            {t.alocacoes && t.alocacoes.length > 1 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-help group relative">
                                                    Rateado
                                                    
                                                    {/* Tooltip premium */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-lg z-30 min-w-[180px] border border-slate-700">
                                                        <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-[9px] text-slate-400 uppercase tracking-wider">
                                                            Divisão do Rateio
                                                        </div>
                                                        <div className="space-y-1">
                                                            {t.alocacoes.map((a) => (
                                                                <div key={a.id} className="flex justify-between gap-3 text-left">
                                                                    <span className="text-slate-300 font-medium">{a.talhao_nome}</span>
                                                                    <span className="font-bold text-white">
                                                                        {formatCurrency(a.valor_alocado)} ({a.percentual_alocado.toFixed(0)}%)
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
                                                    </div>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {t.fornecedor || <span className="text-slate-400 italic">Não informado</span>}
                                    </td>
                                    <td className="p-4 pr-6 whitespace-nowrap text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${t.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.tipo === 'RECEITA' ? '+' : '-'} {formatCurrency(t.valor_total)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                                                {t.tipo}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransacoesTable;
