import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PlusCircle, Trash2, ChevronDown, X } from 'lucide-react';

// @ts-ignore
import LocalizacaoSafInput from './LocalizacaoSafInput';
// @ts-ignore
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

export type ColumnType = 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'saf_visual' | 'saf_location';

export interface TableOption {
    value: string | number;
    label: string;
}

export interface TableColumn {
    id: string;
    label: string;
    type: ColumnType;
    width?: string | number;
    options?: (string | TableOption)[];
    required?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    suffix?: string;
    unitSelector?: {
        key: string;
        options: string[];
    };
}

export interface TableRowBase {
    id: string | number;
    [key: string]: any;
}

export interface TabelaDinamicaProps<T extends TableRowBase> {
    label?: string;
    columns: TableColumn[];
    data: T[];
    onDataChange?: (newData: T[]) => void;
    readOnly?: boolean;
    itemName?: string;
    itemNoun?: string;
    onRowClick?: (item: T) => void;
    disableRowClick?: boolean;
}

const generateUniqueId = (): string => `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Optimized Input Component (native)
const FastInput = React.memo(({ value, onChange, onBlur, type = 'text', multiline = false, rows = 1, suffix, className = '', ...props }: any) => {
    const [localValue, setLocalValue] = useState(value ?? '');

    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    const debouncedChange = useMemo(
        () => debounce((val: string) => onChange(val), 300),
        [onChange]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const val = e.target.value.toUpperCase();
        setLocalValue(val);
        debouncedChange(val);
    };

    const handleBlur = (e: any) => {
        onChange(localValue);
        if (onBlur) onBlur(e);
    };

    const inputCls = `w-full bg-transparent border border-gray-200 dark:border-slate-700 focus:ring-1 focus:ring-green-500 focus:border-green-500 rounded p-1.5 text-sm text-gray-900 dark:text-slate-100 ${className}`;

    if (multiline) {
        return (
            <div className="relative">
                <textarea
                    {...props}
                    value={localValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={rows}
                    className={inputCls}
                />
            </div>
        );
    }

    return (
        <div className="relative flex items-center">
            <input
                {...props}
                type={type}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className={inputCls}
            />
            {suffix && <span className="ml-1 text-xs text-gray-400 shrink-0">{suffix}</span>}
        </div>
    );
});

// ==================================================================
// ||                     COMPONENT DEFINITION                     ||
// ==================================================================

export default function TabelaDinamica<T extends TableRowBase>({
    label,
    columns = [],
    data = [],
    onDataChange,
    readOnly = false,
    itemName = 'Item',
    itemNoun = 'o',
    onRowClick,
    disableRowClick = false
}: TabelaDinamicaProps<T>) {

    // --- PERFORMANCE STATE ---
    const [localData, setLocalData] = useState<T[]>([]);
    const isUserTyping = React.useRef(false);
    const latestLocalData = React.useRef(localData);
    const latestOnChange = React.useRef(onDataChange);
    const debounceTimerRef = React.useRef<any>(null);

    useEffect(() => { latestLocalData.current = localData; }, [localData]);
    useEffect(() => { latestOnChange.current = onDataChange; }, [onDataChange]);

    useEffect(() => {
        if (!isUserTyping.current) {
            const dataWithIds = (Array.isArray(data) ? data : []).map((item, index) => ({
                ...item,
                id: item.id || localData[index]?.id || generateUniqueId(),
            })) as T[];
            setLocalData(dataWithIds);
        }
    }, [data]);

    useEffect(() => {
        if (isUserTyping.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                if (latestOnChange.current) {
                    latestOnChange.current(latestLocalData.current);
                    isUserTyping.current = false;
                }
            }, 800);
        }
        return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
    }, [localData]);

    useEffect(() => {
        return () => {
            if (isUserTyping.current && latestOnChange.current) {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                latestOnChange.current(latestLocalData.current);
            }
        };
    }, []);

    const flush = useCallback(() => {
        if (isUserTyping.current && latestOnChange.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            latestOnChange.current(latestLocalData.current);
            isUserTyping.current = false;
        }
    }, []);

    // --- UI STATES ---
    const [openCards, setOpenCards] = useState<Set<string | number>>(new Set());
    const [itemToDelete, setItemToDelete] = useState<string | number | null>(null);

    const toggleCard = useCallback((id: string | number) => {
        setOpenCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const safeColumns = useMemo(() => {
        return (columns || []).map(col => ({
            ...col,
            id: col.id || (col as any).key,
            label: col.label || (col as any).header || (col as any).key
        }));
    }, [columns]);

    // --- HANDLERS ---
    const handleItemChange = (id: string | number, fieldKey: string, value: any) => {
        isUserTyping.current = true;
        setLocalData(prev => prev.map(item => {
            if (item.id !== id) return item;
            return { ...item, [fieldKey]: value };
        }));
    };

    const adicionarItem = () => {
        const novoId = generateUniqueId();
        const novoItem: any = safeColumns.reduce((acc: any, col) => {
            acc[col.id] = '';
            if (col.unitSelector) acc[col.unitSelector.key] = col.unitSelector.options?.[0] || '';
            return acc;
        }, { id: novoId });
        const newData = [...localData, novoItem];
        setLocalData(newData);
        if (onDataChange) onDataChange(newData);
        // CR#3: New item opens automatically
        setOpenCards(prev => new Set(prev).add(novoId));
    };

    const removerItem = (id: string | number) => { setItemToDelete(id); };

    const confirmarRemocao = () => {
        if (itemToDelete) {
            const newData = localData.filter(item => item.id !== itemToDelete);
            setLocalData(newData);
            if (onDataChange) onDataChange(newData);
            setOpenCards(prev => {
                const next = new Set(prev);
                next.delete(itemToDelete);
                return next;
            });
            setItemToDelete(null);
        }
    };

    const cancelarRemocao = () => { setItemToDelete(null); };

    // --- RENDER HELPERS ---
    const renderValue = (item: Partial<T>, col: TableColumn) => {
        const val = item[col.id];
        if (val && typeof val === 'object') {
            if ('_display' in val) return val._display || '';
            if (val.talhao_nome || val.canteiro_nome) return `📍 ${val.talhao_nome || '?'} › ${val.canteiro_nome || '?'}`;
            return '-';
        }
        if (col.unitSelector) {
            return val !== undefined && val !== null && val !== '' ? `${val} ${item[col.unitSelector.key] ?? ''}` : '-';
        }
        return val ?? '-';
    };

    const renderInputControl = (col: TableColumn, value: any, onChange: (val: any) => void, onBlurCmd?: () => void, unitValue?: any, onUnitChange?: (val: any) => void) => {
        if (col.type === 'saf_visual' || col.type === 'saf_location') {
            const Component = col.type === 'saf_visual' ? SeletorLocalizacaoSaf : LocalizacaoSafInput;
            return <Component value={value ?? ''} onChange={onChange} size="small" />;
        }

        if (col.type === 'select') {
            const options = col.options || [];
            const isValidOption = options.some((opt: string | TableOption) => {
                const v = typeof opt === 'object' ? opt.value : opt;
                return String(v) === String(value);
            });
            const safeValue = isValidOption ? value : '';

            return (
                <select
                    value={safeValue ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlurCmd}
                    className="w-full border border-gray-200 dark:border-slate-700 rounded p-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                >
                    <option value="" disabled>Selecione</option>
                    {options.map((opt, index) => {
                        const v = typeof opt === 'object' ? opt.value : opt;
                        const lab = typeof opt === 'object' ? opt.label : opt;
                        return <option key={index} value={v}>{lab}</option>;
                    })}
                </select>
            );
        }

        if (col.unitSelector) {
            const options = col.unitSelector.options || [];
            const currentVal = unitValue ?? '';
            const isCustom = currentVal && !options.includes(currentVal);
            const effectiveOptions = isCustom ? [currentVal, ...options] : options;

            return (
                <div className="flex items-center gap-1">
                    <FastInput value={value ?? ''} onChange={(val: any) => onChange(val)} onBlur={onBlurCmd} />
                    <select
                        value={currentVal}
                        onChange={(e) => onUnitChange && onUnitChange(e.target.value)}
                        onBlur={onBlurCmd}
                        className="border border-gray-200 dark:border-slate-700 rounded p-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 min-w-[70px] focus:ring-1 focus:ring-green-500"
                    >
                        {effectiveOptions.map(opt => (
                            <option key={opt} value={opt}>{isCustom && opt === currentVal ? `${opt} *` : opt}</option>
                        ))}
                    </select>
                </div>
            );
        }

        return (
            <FastInput
                type={col.type === 'number' ? 'number' : 'text'}
                value={value ?? ''}
                onChange={(val: any) => onChange(val)}
                onBlur={onBlurCmd}
                multiline={col.type === 'textarea'}
                rows={col.type === 'textarea' ? 3 : 1}
                suffix={col.suffix}
            />
        );
    };

    const renderField = (item: T, col: TableColumn) => {
        if (readOnly || col.readOnly) {
            return <span className="text-sm text-gray-700">{String(renderValue(item, col))}</span>;
        }
        return renderInputControl(
            col, item[col.id],
            (val) => handleItemChange(item.id, col.id, val),
            flush,
            col.unitSelector ? item[col.unitSelector.key] : undefined,
            col.unitSelector ? (val) => handleItemChange(item.id, col.unitSelector!.key, val) : undefined
        );
    };

    // --- CARD MAP HELPERS ---
    const getCardMap = (cols: TableColumn[]) => {
        const titleCol = cols.find(c => ['produto', 'cultura', 'especie', 'nome', 'produto_ou_manejo', 'tipo_animal', 'animal_lote', 'alimento'].includes(c.id)) || cols[0];
        const badgeCol = cols.find(c => ['atividade', 'tipo', 'status', 'categoria'].includes(c.id));
        const footerCol = cols.find(c => c.unitSelector || ['quantidade', 'area_plantada', 'producao_esperada_ano', 'n_de_animais'].includes(c.id));
        return { titleCol, badgeCol, footerCol };
    };
    const { titleCol, badgeCol, footerCol } = getCardMap(safeColumns);

    // --- CR#2: Title fallback for empty items ---
    const getCardTitle = (item: T): string => {
        const val = renderValue(item, titleCol);
        const str = String(val).trim();
        if (!str || str === '-' || str === '') {
            return itemName ? `Novo ${itemName}` : 'Novo Registo';
        }
        return str;
    };

    const isCardTitleEmpty = (item: T): boolean => {
        const val = renderValue(item, titleCol);
        const str = String(val).trim();
        return !str || str === '-' || str === '';
    };

    // --- RENDER ---
    return (
        <div className="my-3">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                {label && <h3 className="text-lg font-semibold text-gray-800">{label}</h3>}
                {!readOnly && (
                    <button
                        type="button"
                        onClick={adicionarItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                        <PlusCircle size={16} /> Adicionar
                    </button>
                )}
            </div>

            {/* Empty State */}
            {localData.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-400">
                        Nenhum {itemName?.toLowerCase() || 'item'} adicionado.
                    </p>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={adicionarItem}
                            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        >
                            <PlusCircle size={18} />
                            Adicionar {itemNoun ? `nov${itemNoun}` : ''} {itemName}
                        </button>
                    )}
                </div>
            )}

            {/* Cards List */}
            <div className="flex flex-col gap-3">
                {localData.map((item) => {
                    const isOpen = openCards.has(item.id);
                    const hasRowClick = !disableRowClick && onRowClick;
                    const cardTitle = getCardTitle(item);
                    const titleEmpty = isCardTitleEmpty(item);

                    return (
                        <div
                            key={item.id}
                            className={`border rounded-xl overflow-hidden transition-all shadow-sm ${isOpen
                                ? 'border-green-500 shadow-md ring-1 ring-green-500/20'
                                : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow'
                                } bg-white dark:bg-slate-900`}
                        >
                            {/* Card Header */}
                            <div
                                className={`flex items-center gap-3 px-4 py-3 ${isOpen ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800/50'} ${hasRowClick && !isOpen ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800' : ''
                                    } transition-colors`}
                                onClick={() => {
                                    // CR#1: onRowClick fires on header click (only when card is closed)
                                    if (hasRowClick && !isOpen) {
                                        onRowClick!(item);
                                    }
                                }}
                            >
                                {/* Badge */}
                                {badgeCol && item[badgeCol.id] && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border border-green-600 text-green-700 shrink-0">
                                        {item[badgeCol.id]}
                                    </span>
                                )}

                                {/* Title + Footer summary */}
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold leading-tight truncate ${titleEmpty ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-800 dark:text-slate-100'
                                        }`}>
                                        {cardTitle}
                                    </h4>
                                    {footerCol && !isOpen && (
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                                            {footerCol.label}: <span className="font-semibold text-gray-700 dark:text-slate-300">{renderValue(item, footerCol)}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            title="Remover"
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            onClick={(e) => {
                                                // CR#1: stopPropagation so delete doesn't trigger onRowClick
                                                e.stopPropagation();
                                                removerItem(item.id);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        title={isOpen ? 'Fechar' : 'Expandir'}
                                        className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                                        onClick={(e) => {
                                            // CR#1: stopPropagation so chevron doesn't trigger onRowClick
                                            e.stopPropagation();
                                            toggleCard(item.id);
                                        }}
                                    >
                                        <ChevronDown
                                            size={18}
                                            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Card Body (Accordion) */}
                            {isOpen && (
                                <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {safeColumns.map(col => (
                                            <div key={col.id} className={col.type === 'textarea' ? 'md:col-span-2' : ''}>
                                                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">
                                                    {col.label}
                                                </label>
                                                {renderField(item, col)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Add Button (desktop convenience) */}
            {localData.length > 0 && !readOnly && (
                <button
                    type="button"
                    onClick={adicionarItem}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                >
                    <PlusCircle size={18} />
                    Adicionar nov{itemNoun} {itemName}
                </button>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {itemToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={cancelarRemocao}>
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-gray-600 mb-4">Deseja remover este item?</p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancelarRemocao} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                            <button type="button" onClick={confirmarRemocao} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Remover</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
