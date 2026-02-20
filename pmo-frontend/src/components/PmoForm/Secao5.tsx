// src/components/PmoForm/Secao5.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, ChangeEvent } from 'react';
import { ChevronDown, PlusCircle, Trash2 } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import SectionShell from '../Plan/SectionShell';

// Types
interface ProdutoTerceirizado {
    id?: string;
    fornecedor?: string;
    localidade?: string;
    produto?: string;
    quantidade_ano?: string | number;
    processamento?: boolean | null;
}

interface TabelaProducaoTerceirizadaProps {
    itens: ProdutoTerceirizado[];
    onItensChange: (itens: ProdutoTerceirizado[]) => void;
}

interface Secao5Data {
    produtos_terceirizados?: ProdutoTerceirizado[];
    [key: string]: any;
}

interface Secao5MUIProps {
    data: Secao5Data | null | undefined;
    onSectionChange: (data: Secao5Data) => void;
}

const inputCls = "w-full border-b border-gray-300 bg-transparent py-1 text-sm focus:border-green-500 focus:outline-none";
const labelCls = "text-xs font-medium text-gray-600 mb-1 block";

const TabelaProducaoTerceirizada: React.FC<TabelaProducaoTerceirizadaProps> = ({ itens, onItensChange }) => {
    const isMobile = useIsMobile(768); // md breakpoint

    const handleItemChange = (index: number, name: string, value: string | boolean) => {
        const novosItens = [...itens];
        novosItens[index] = { ...novosItens[index], [name]: value };
        onItensChange(novosItens);
    };

    const adicionarItem = () => {
        onItensChange([...itens, { id: `new_${Date.now()}`, fornecedor: '', localidade: '', produto: '', quantidade_ano: '', processamento: null }]);
    };

    const removerItem = (index: number) => {
        onItensChange(itens.filter((_, i) => i !== index));
    };

    const DesktopLayout = () => (
        <div className="border border-gray-200 rounded-lg overflow-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-bold text-gray-700">Fornecedor</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">Localidade</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">Produto</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">Quantidade/ano</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700">Processamento</th>
                        <th className="px-3 py-2 text-center font-bold text-gray-700">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    {(itens || []).map((item, index) => (
                        <tr key={item.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-1"><input className={inputCls} value={item.fornecedor || ''} onChange={(e) => handleItemChange(index, 'fornecedor', e.target.value)} /></td>
                            <td className="px-3 py-1"><input className={inputCls} value={item.localidade || ''} onChange={(e) => handleItemChange(index, 'localidade', e.target.value)} /></td>
                            <td className="px-3 py-1"><input className={inputCls} value={item.produto || ''} onChange={(e) => handleItemChange(index, 'produto', e.target.value)} /></td>
                            <td className="px-3 py-1"><input className={inputCls} type="number" value={item.quantidade_ano || ''} onChange={(e) => handleItemChange(index, 'quantidade_ano', e.target.value)} /></td>
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name={`proc-${index}`} checked={item.processamento === true} onChange={() => handleItemChange(index, 'processamento', true)} className="w-3.5 h-3.5" /> Sim
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name={`proc-${index}`} checked={item.processamento === false} onChange={() => handleItemChange(index, 'processamento', false)} className="w-3.5 h-3.5" /> Não
                                    </label>
                                </div>
                            </td>
                            <td className="px-3 py-1 text-center">
                                <button onClick={() => removerItem(index)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const MobileLayout = () => (
        <div className="space-y-3">
            {(itens || []).map((item, index) => (
                <div key={item.id || index} className="border border-gray-200 rounded-lg p-3 relative shadow-sm">
                    <button onClick={() => removerItem(index)} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded">
                        <Trash2 size={16} />
                    </button>
                    <div className="space-y-2">
                        <div><label className={labelCls}>Fornecedor</label><input className={inputCls} value={item.fornecedor || ''} onChange={(e) => handleItemChange(index, 'fornecedor', e.target.value)} /></div>
                        <div><label className={labelCls}>Localidade</label><input className={inputCls} value={item.localidade || ''} onChange={(e) => handleItemChange(index, 'localidade', e.target.value)} /></div>
                        <div><label className={labelCls}>Produto</label><input className={inputCls} value={item.produto || ''} onChange={(e) => handleItemChange(index, 'produto', e.target.value)} /></div>
                        <div><label className={labelCls}>Quantidade/ano</label><input className={inputCls} type="number" value={item.quantidade_ano || ''} onChange={(e) => handleItemChange(index, 'quantidade_ano', e.target.value)} /></div>
                        <div>
                            <label className={labelCls}>Processamento</label>
                            <div className="flex gap-4 text-sm mt-1">
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`proc-m-${index}`} checked={item.processamento === true} onChange={() => handleItemChange(index, 'processamento', true)} className="w-3.5 h-3.5" /> Sim</label>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`proc-m-${index}`} checked={item.processamento === false} onChange={() => handleItemChange(index, 'processamento', false)} className="w-3.5 h-3.5" /> Não</label>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div>
            {isMobile ? <MobileLayout /> : <DesktopLayout />}
            <button onClick={adicionarItem} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-md">
                <PlusCircle size={16} /> Adicionar Produto Terceirizado
            </button>
        </div>
    );
};

// Accordion Panel helper
const AccordionPanel: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <span className="font-bold text-sm text-gray-800">{title}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="p-4">{children}</div>}
        </div>
    );
};

const Secao5MUI: React.FC<Secao5MUIProps> = ({ data, onSectionChange }) => {
    const handleTabelaChange = (novoArray: ProdutoTerceirizado[]) => {
        onSectionChange({ ...data, produtos_terceirizados: novoArray });
    };

    return (
        <SectionShell
            sectionLabel="Seção 5"
            title="Produção Terceirizada"
        >
            <AccordionPanel title="5.1. Adquire produtos de terceiros para processar ou comercializar sem processamento?" defaultOpen>
                <TabelaProducaoTerceirizada
                    itens={data?.produtos_terceirizados || []}
                    onItensChange={handleTabelaChange}
                />
            </AccordionPanel>
        </SectionShell>
    );
};

export default Secao5MUI;
