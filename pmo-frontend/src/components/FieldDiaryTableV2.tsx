import React from 'react';
import {
    Filter, RefreshCw, Plus, Eye, Pencil, Trash2,
    AlertOctagon, Ban, ListChecks, X, Calendar, MapPin, Mic
} from 'lucide-react';

import {
    CadernoCampoRecord,
    ActivityType,
    ManejoSubtype,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesPlantio
} from '../types/CadernoTypes';

// Import shared types
import { FieldDiaryFilters } from '../hooks/useFieldDiary';
import { formatDateBR, formatComplianceMessage } from '../utils/formatters';
import { AlertTriangle } from 'lucide-react'; // Already used

interface FieldDiaryTableV2Props {
    // Data (Prefiltered & Paginated)
    registros: CadernoCampoRecord[];
    totalCount: number;
    loading: boolean;

    // Filters (Passed from Hook)
    filtrosAtivos: FieldDiaryFilters;
    onChangeFiltros: (f: FieldDiaryFilters) => void;

    // Pagination (Passed from Hook)
    page: number;
    rowsPerPage: number;
    onPageChange: (event: unknown, newPage: number) => void;
    onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

    // Actions
    onVisualizar: (reg: CadernoCampoRecord) => void;
    onEditar: (reg: CadernoCampoRecord) => void;
    onExcluir: (reg: CadernoCampoRecord) => void;
    onAtualizar: () => void;
    onNovoRegistro: () => void;
}

// --- Chip color helper ---
const getStatusClasses = (tipo: string): { bg: string; text: string; border: string } => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
        'Insumo': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
        'Manejo': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
        'Plantio': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
        'Colheita': { bg: 'bg-primary-main/10', text: 'text-primary-dark', border: 'border-primary-main/30' },
        'CANCELADO': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
    };
    return map[tipo] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
};

// --- Mobile card border color ---
const getMobileBorderColor = (tipo: string): string => {
    const map: Record<string, string> = {
        'Plantio': '#2e7d32',
        'Manejo': '#0288d1',
        'Colheita': '#ed6c02',
        'CANCELADO': '#ef5350',
    };
    return map[tipo] || '#bdbdbd';
};

const FieldDiaryTableV2: React.FC<FieldDiaryTableV2Props> = ({
    registros,
    totalCount,
    loading,
    filtrosAtivos,
    onChangeFiltros,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    onVisualizar,
    onEditar,
    onExcluir,
    onAtualizar,
    onNovoRegistro
}) => {
    // --- UI STATE ONLY (Filter Popover) ---
    const [filterAnchorEl, setFilterAnchorEl] = React.useState<null | HTMLElement>(null);
    const [activeFilterColumn, setActiveFilterColumn] = React.useState<string | null>(null);
    // For positioning the popover
    const [popoverPos, setPopoverPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const handleOpenFilter = (event: React.MouseEvent<HTMLElement>, column: string) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPopoverPos({ top: rect.bottom + 4, left: rect.left });
        setFilterAnchorEl(event.currentTarget);
        setActiveFilterColumn(column);
    };

    const handleCloseFilter = () => {
        setFilterAnchorEl(null);
        setActiveFilterColumn(null);
    };

    const handleFilterChange = (field: keyof FieldDiaryFilters, value: any) => {
        onChangeFiltros({
            ...filtrosAtivos,
            [field]: value
        });
    };

    // --- HELPER RENDERS (Pure Functions) ---
    const getRegistroLocalResumo = (reg: CadernoCampoRecord): string => {
        if (reg.atividades && reg.atividades.length > 0) {
            const locaisUnicos = new Set<string>();
            for (const item of reg.atividades) {
                if (item.local?.talhao) {
                    const local = item.local.canteiro
                        ? `${item.local.talhao}, Canteiro ${item.local.canteiro}`
                        : item.local.talhao;
                    locaisUnicos.add(local);
                }
            }
            const locaisArr = Array.from(locaisUnicos);
            if (locaisArr.length === 0) return reg.talhao_canteiro || 'Local não informado';
            if (locaisArr.length === 1) return locaisArr[0];
            return `${locaisArr[0]} +${locaisArr.length - 1}`;
        }
        return reg.talhao_canteiro || 'Local não informado';
    };

    const renderDetails = (row: CadernoCampoRecord) => {
        const details = row.detalhes_tecnicos || {};
        const tipo = row.tipo_atividade;
        const complianceMsg = formatComplianceMessage(row.observacao_original);

        // 1. Compliance Alert (Prioridade Visual via Tooltip)
        if (complianceMsg) {
            return (
                <div className="relative flex items-center group cursor-pointer ml-1 inline-flex">
                    <AlertTriangle className="w-5 h-5 text-amber-500 hover:text-amber-600 transition-colors" />
                    <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 hidden group-hover:block group-active:block w-64 p-3 text-xs sm:text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg shadow-xl z-50 pointer-events-none">
                        <div className="absolute top-full right-2 sm:left-1/2 sm:-translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                        <p className="font-bold mb-1 uppercase tracking-tight text-[10px] opacity-70">Alerta de Compliance</p>
                        {complianceMsg}
                    </div>
                </div>
            );
        }

        if (tipo === ActivityType.MANEJO || tipo === 'Manejo') {
            const d = details as DetalhesManejo;
            if (d.subtipo === ManejoSubtype.HIGIENIZACAO) {
                return (
                    <span>
                        {d.item_higienizado && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-blue-300 text-blue-800 bg-blue-50 mr-1 my-0.5">
                                🧹 {d.item_higienizado}
                            </span>
                        )}
                        {d.produto_utilizado && <span className="text-xs text-gray-500">com {d.produto_utilizado}</span>}
                    </span>
                );
            }
            if (d.subtipo === ManejoSubtype.APLICACAO_INSUMO) {
                const dose = d.dosagem ? `${d.dosagem}${d.unidade_dosagem || ''}` : '';
                return (
                    <span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-amber-300 text-amber-800 bg-amber-50 mr-1 my-0.5">
                            💊 {d.insumo || d.nome_insumo || 'Insumo'}
                        </span>
                        {dose && <span className="text-xs">{dose}</span>}
                    </span>
                );
            }
            const ativ = d.atividade || d.tipo_manejo || row.observacao_original;
            return <span className="text-sm text-gray-900">{ativ}</span>;
        }

        if (tipo === ActivityType.COLHEITA || tipo === 'Colheita') {
            const d = details as DetalhesColheita;
            return (
                <span>
                    {d.lote && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1 my-0.5" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>📦 {d.lote}</span>}
                    {d.classificacao && <span className="text-xs font-bold" style={{ color: '#b45309' }}>{d.classificacao}</span>}
                </span>
            );
        }

        if (tipo === ActivityType.PLANTIO || tipo === 'Plantio') {
            const d = details as DetalhesPlantio;
            return (
                <span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-green-300 text-green-800 bg-green-50 mr-1 my-0.5">
                        🌱 {d.metodo_propagacao || 'Plantio'}
                    </span>
                </span>
            );
        }

        return (
            <span title={row.observacao_original || ''}>
                <p className="text-sm max-w-[300px] whitespace-normal break-words">
                    {row.observacao_original || '-'}
                </p>
            </span>
        );
    };

    const getAlertIcon = (reg: CadernoCampoRecord) => {
        const obs = reg.observacao_original || '';
        const isCompliance = formatComplianceMessage(obs);
        if (isCompliance) return null;

        if (obs.includes('⛔') || obs.includes('RECUSADO')) {
            return <span title="Registro Recusado / Bloqueado"><Ban className="w-4 h-4 text-red-500 mr-1 inline align-middle" /></span>;
        }
        if (obs.includes('⚠️') || obs.includes('[SISTEMA') || obs.includes('ALERTA')) {
            return <span title="Alerta do Sistema"><AlertOctagon className="w-4 h-4 text-amber-500 mr-1 inline align-middle" /></span>;
        }
        return null;
    };

    // --- Filter Popover (native dropdown positioned absolutely) ---
    const renderFilterPopover = () => {
        if (!activeFilterColumn || !filterAnchorEl) return null;

        return (
            <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={handleCloseFilter} />

                {/* Popover Panel */}
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]"
                    style={{ top: popoverPos.top, left: popoverPos.left }}
                >
                    {activeFilterColumn === 'data' && (
                        <div className="p-3 flex flex-col gap-2 min-w-[250px]">
                            <p className="text-sm font-bold text-gray-800">Filtrar por Período</p>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">Data Início</label>
                                <input
                                    type="date"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none"
                                    value={filtrosAtivos.dataInicio}
                                    onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">Data Fim</label>
                                <input
                                    type="date"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none"
                                    value={filtrosAtivos.dataFim}
                                    onChange={(e) => handleFilterChange('dataFim', e.target.value)}
                                />
                            </div>
                            <div className="flex justify-between gap-1">
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => { handleFilterChange('dataInicio', ''); handleFilterChange('dataFim', ''); }}
                                >
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary-main rounded-md hover:bg-primary-dark"
                                    onClick={handleCloseFilter}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}

                    {activeFilterColumn === 'atividade' && (
                        <div className="p-3 flex flex-col gap-2 min-w-[200px]">
                            <p className="text-sm font-bold text-gray-800">Filtrar por Atividade</p>
                            <select
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none bg-white"
                                value={filtrosAtivos.tipo_atividade}
                                onChange={(e) => handleFilterChange('tipo_atividade', e.target.value)}
                            >
                                <option value="Todos">Todas</option>
                                <option value={ActivityType.PLANTIO}>Plantio</option>
                                <option value={ActivityType.MANEJO}>Manejo</option>
                                <option value={ActivityType.COLHEITA}>Colheita</option>
                                <option value={ActivityType.INSUMO}>Insumo</option>
                                <option value={ActivityType.OUTRO}>Outro</option>
                                <option value={ActivityType.CANCELADO}>CANCELADO</option>
                            </select>
                            <div className="flex justify-between gap-1">
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    onClick={() => handleFilterChange('tipo_atividade', 'Todos')}
                                >
                                    Limpar
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary-main rounded-md hover:bg-primary-dark"
                                    onClick={handleCloseFilter}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}

                    {activeFilterColumn === 'produto' && (
                        <div className="p-3 flex flex-col gap-2 min-w-[250px]">
                            <p className="text-sm font-bold text-gray-800">Filtrar por Produto</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Contém..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none pr-8"
                                    value={filtrosAtivos.produto}
                                    onChange={(e) => handleFilterChange('produto', e.target.value)}
                                />
                                {filtrosAtivos.produto && (
                                    <button
                                        type="button"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 rounded-full hover:bg-gray-100"
                                        onClick={() => handleFilterChange('produto', '')}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary-main rounded-md hover:bg-primary-dark"
                                    onClick={handleCloseFilter}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}

                    {activeFilterColumn === 'local' && (
                        <div className="p-3 flex flex-col gap-2 min-w-[250px]">
                            <p className="text-sm font-bold text-gray-800">Filtrar por Local</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Contém..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none pr-8"
                                    value={filtrosAtivos.local}
                                    onChange={(e) => handleFilterChange('local', e.target.value)}
                                />
                                {filtrosAtivos.local && (
                                    <button
                                        type="button"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 rounded-full hover:bg-gray-100"
                                        onClick={() => handleFilterChange('local', '')}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary-main rounded-md hover:bg-primary-dark"
                                    onClick={handleCloseFilter}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    };

    // --- Pagination helpers ---
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const from = page * rowsPerPage + 1;
    const to = Math.min((page + 1) * rowsPerPage, totalCount);

    return (
        <div className="w-full max-w-full min-w-0 overflow-hidden flex flex-col gap-6 mb-10">
            {/* 1. HEADER & ACTIONS */}
            <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2">
                        <h6 className="flex gap-1 font-bold text-lg items-center">
                            <ListChecks className="w-5 h-5 text-primary-main" /> Diário de Campo
                        </h6>
                        <div className="flex items-center gap-1 flex-wrap max-w-full sm:max-w-none">
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                                onClick={onAtualizar}
                            >
                                <RefreshCw className="w-4 h-4 mr-1.5" />
                                Atualizar
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700"
                                onClick={onNovoRegistro}
                            >
                                <Plus className="w-4 h-4 mr-1.5" />
                                Novo Registro
                            </button>
                        </div>
                    </div>
                    <label className="inline-flex items-center gap-2 ml-0 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filtrosAtivos.incluirCancelados}
                            onChange={(e) => handleFilterChange('incluirCancelados', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-main focus:ring-primary-main/30"
                        />
                        <span className="text-sm text-gray-500">Ver Cancelados</span>
                    </label>
                </div>
            </div>

            {/* 3. CONTENT AREA */}
            {loading ? (
                <div className="flex justify-center p-5">
                    <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                </div>
            ) : registros.length === 0 ? (
                <div className="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-gray-500">Nenhum registro encontrado para os filtros selecionados.</p>
                </div>
            ) : (
                <>
                    {/* --- DESKTOP TABLE --- */}
                    <div className="hidden md:block w-full max-w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white min-w-0">
                        <table className="min-w-[800px] w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                                        <button type="button" className="flex items-center gap-0.5 hover:text-primary-main transition-colors" onClick={(e) => handleOpenFilter(e, 'data')}>
                                            Data <Filter className={`w-3.5 h-3.5 ${(filtrosAtivos.dataInicio || filtrosAtivos.dataFim) ? 'text-primary-main opacity-100' : 'opacity-30'}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                                        <button type="button" className="flex items-center gap-0.5 hover:text-primary-main transition-colors" onClick={(e) => handleOpenFilter(e, 'atividade')}>
                                            Atividade <Filter className={`w-3.5 h-3.5 ${filtrosAtivos.tipo_atividade !== 'Todos' ? 'text-primary-main opacity-100' : 'opacity-30'}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">
                                        <button type="button" className="flex items-center gap-0.5 hover:text-primary-main transition-colors" onClick={(e) => handleOpenFilter(e, 'produto')}>
                                            Produto / Cultura <Filter className={`w-3.5 h-3.5 ${filtrosAtivos.produto ? 'text-primary-main opacity-100' : 'opacity-30'}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[26%] whitespace-normal break-words">
                                        <button type="button" className="flex items-center gap-0.5 hover:text-primary-main transition-colors" onClick={(e) => handleOpenFilter(e, 'local')}>
                                            Localização <Filter className={`w-3.5 h-3.5 ${filtrosAtivos.local ? 'text-primary-main opacity-100' : 'opacity-30'}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[20%] whitespace-normal break-words">Resumo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[12%]">
                                        <span className="flex items-center gap-0.5"><Mic className="w-3.5 h-3.5" /> Áudio</span>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-[8%]">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {registros.map((reg) => {
                                    const isCancelled = reg.tipo_atividade === ActivityType.CANCELADO;
                                    const sc = getStatusClasses(reg.tipo_atividade);
                                    return (
                                        <tr key={reg.id} className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'bg-red-50/50' : ''}`} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                                            <td className="px-4 py-3 text-sm text-gray-900">{formatDateBR(reg.data_registro)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${isCancelled ? `border ${sc.border} ${sc.text} bg-transparent` : `${sc.bg} ${sc.text}`
                                                    }`}>
                                                    {reg.tipo_atividade}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{reg.produto}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-normal break-words">{getRegistroLocalResumo(reg)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-normal break-words overflow-visible">
                                                <div className="flex items-center">{getAlertIcon(reg)}{renderDetails(reg)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {reg.audio_url ? (
                                                    <audio controls src={reg.audio_url} preload="metadata" style={{ height: '32px', maxWidth: '180px', width: '100%' }} />
                                                ) : (
                                                    <span className="text-sm text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-row items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="Ver Detalhes"
                                                        className="inline-flex items-center justify-center p-1.5 text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                                        onClick={() => onVisualizar(reg)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {!isCancelled && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                title="Editar"
                                                                className="inline-flex items-center justify-center p-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                                                                onClick={() => onEditar(reg)}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Excluir/Cancelar"
                                                                className="inline-flex items-center justify-center p-1.5 text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                                                                onClick={() => onExcluir(reg)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* --- MOBILE CARDS --- */}
                    <div className="flex md:hidden flex-col gap-2">
                        {registros.map((reg) => {
                            const isCancelled = reg.tipo_atividade === ActivityType.CANCELADO;
                            const borderColor = getMobileBorderColor(reg.tipo_atividade);
                            const sc = getStatusClasses(reg.tipo_atividade);
                            const hasAlert = (reg.observacao_original || '').includes('⛔') || (reg.observacao_original || '').includes('⚠️') || (reg.observacao_original || '').includes('[SISTEMA');
                            const alertIcon = getAlertIcon(reg);

                            return (
                                <div
                                    key={reg.id}
                                    className="rounded-xl shadow-md overflow-hidden"
                                    style={{ borderWidth: 2, borderStyle: 'solid', borderColor, opacity: isCancelled ? 0.7 : 1 }}
                                >
                                    {/* Card Header */}
                                    <div className="p-2.5 border-b border-gray-200 bg-gray-50">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm text-gray-500 font-medium flex items-center gap-0.5">
                                                <Calendar className="w-4 h-4" /> {formatDateBR(reg.data_registro)}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${sc.bg} ${sc.text}`}>
                                                {reg.tipo_atividade.toUpperCase()}
                                            </span>
                                        </div>
                                        <h6 className="text-lg font-bold leading-tight">{reg.produto}</h6>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-2">
                                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-1.5">
                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-0.5 flex items-center gap-0.5">
                                                <MapPin className="w-3 h-3" /> Localização
                                            </p>
                                            <p className="text-sm font-medium">{getRegistroLocalResumo(reg)}</p>
                                        </div>
                                        {(hasAlert || reg.observacao_original || reg.detalhes_tecnicos) && (
                                            <>
                                                <p className="text-[10px] uppercase font-bold text-gray-500 mt-2 mb-1">Observações</p>
                                                {formatComplianceMessage(reg.observacao_original) ? (
                                                    <div className="relative flex items-center group cursor-pointer mt-2 w-fit">
                                                        <div className="flex items-center gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                                                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                                            <span className="font-bold">Ver Alerta de Compliance</span>
                                                        </div>
                                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block group-active:block w-72 p-4 text-sm text-amber-900 bg-white border border-amber-200 rounded-lg shadow-2xl z-50 pointer-events-none">
                                                            <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-amber-200"></div>
                                                            <p className="font-bold mb-1 uppercase tracking-widest text-[10px] text-amber-600">Alerta de Compliance</p>
                                                            {formatComplianceMessage(reg.observacao_original)}
                                                        </div>
                                                    </div>
                                                ) : hasAlert ? (
                                                    <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg p-1.5">
                                                        {alertIcon} <span className="text-sm text-orange-800 font-medium">Registro Automático</span>
                                                    </div>
                                                ) : (
                                                    <div className="mt-0.5 p-1.5 bg-yellow-50 border border-yellow-100 rounded-lg">{renderDetails(reg)}</div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="flex flex-wrap sm:flex-nowrap gap-0.5 sm:gap-1 w-full border-t border-gray-200 bg-gray-50 p-1">
                                        <button
                                            type="button"
                                            className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                                            onClick={() => onVisualizar(reg)}
                                        >
                                            <Eye className="w-4 h-4" /> VER
                                        </button>
                                        {!isCancelled && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors"
                                                    onClick={() => onEditar(reg)}
                                                >
                                                    <Pencil className="w-4 h-4" /> EDITAR
                                                </button>
                                                <button
                                                    type="button"
                                                    className="flex items-center justify-center flex-1 px-2 py-2 gap-1 text-xs sm:text-sm font-bold text-red-700 rounded-md hover:bg-red-50 transition-colors"
                                                    onClick={() => onExcluir(reg)}
                                                >
                                                    <Trash2 className="w-4 h-4" /> EXCLUIR
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* SHARED PAGINATION CONTROLS (native) */}
                    <div className="w-full max-w-full min-w-0 overflow-x-auto">
                        <div className="flex items-center justify-between px-2 py-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <span>Linhas:</span>
                                <select
                                    className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main outline-none"
                                    value={rowsPerPage}
                                    onChange={(e) => onRowsPerPageChange(e as any)}
                                >
                                    {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <span>
                                {totalCount > 0 ? `${from}-${to} de ${totalCount}` : '0 registros'}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={page === 0}
                                    className="px-2 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={() => onPageChange(null, page - 1)}
                                >
                                    ←
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages - 1}
                                    className="px-2 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={() => onPageChange(null, page + 1)}
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && totalCount > 0 && (
                <p className="text-xs text-gray-500 text-right mr-2">
                    Total Geral: {totalCount}
                </p>
            )}

            {renderFilterPopover()}
        </div>
    );
};

export default FieldDiaryTableV2;
