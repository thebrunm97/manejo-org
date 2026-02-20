// src/components/PmoForm/Secao9.tsx — Zero MUI
import React, { useState, ChangeEvent } from 'react';
import { ChevronDown, PlusCircle, Sprout, X, AlertTriangle } from 'lucide-react';
import SectionShell from '../Plan/SectionShell';
import PropagacaoCard from './cards/PropagacaoCard';

interface PropagacaoItem { _id: string; tipo?: string; especies?: string; origem?: string; quantidade?: string; sistema_organico?: boolean; data_compra?: string; }
interface Secao9Data { sementes_mudas_organicas?: PropagacaoItem[]; sementes_mudas_nao_organicas?: PropagacaoItem[]; tratamento_sementes_mudas?: { tratamento_sementes_mudas?: string }; manejo_producao_propria?: { manejo_producao_propria?: string }; postura_uso_materiais_transgenicos_organica?: { postura_uso_materiais_transgenicos_organica?: string }; cuidados_uso_materiais_transgenicos_nao_organica?: { cuidados_uso_materiais_transgenicos_nao_organica?: string };[key: string]: any; }
interface Secao9MUIProps { data: Secao9Data | null | undefined; onSectionChange: (d: Secao9Data) => void; }

const genId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const iCls = "w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";
const lCls = "text-xs font-medium text-gray-600 mb-1 block";
const taCls = "w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-y";

const TIPOS = [{ v: 'semente', l: 'Semente' }, { v: 'muda', l: 'Muda' }, { v: 'estaca', l: 'Estaca' }, { v: 'bulbo', l: 'Bulbo' }, { v: 'rizoma', l: 'Rizoma' }, { v: 'maniva', l: 'Maniva' }, { v: 'tuberculo', l: 'Tubérculo' }, { v: 'rebento', l: 'Rebento' }, { v: 'meristema', l: 'Meristema' }];

const AP: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [o, setO] = useState(defaultOpen);
    return (<div className="border border-gray-200 rounded-lg overflow-hidden"><button type="button" onClick={() => setO(!o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"><span className="font-bold text-sm text-gray-800">{title}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${o ? 'rotate-180' : ''}`} /></button>{o && <div className="p-4">{children}</div>}</div>);
};

const Secao9MUI: React.FC<Secao9MUIProps> = ({ data, onSectionChange }) => {
    const sd = data || {};
    const [mOpen, setMOpen] = useState(false);
    const [listKey, setListKey] = useState<string | null>(null);
    const [ei, setEi] = useState<PropagacaoItem | null>(null);
    const [dOpen, setDOpen] = useState(false);
    const [dItem, setDItem] = useState<{ lk: string; id: string } | null>(null);

    const hc = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onSectionChange({ ...sd, [e.target.name]: { [e.target.name]: e.target.value } }); };

    const addNew = (lk: string) => { setListKey(lk); setEi({ _id: genId(), tipo: 'semente', especies: '', origem: '', quantidade: '', sistema_organico: true, data_compra: '' }); setMOpen(true); };
    const edit = (lk: string, it: PropagacaoItem) => { setListKey(lk); setEi({ ...it }); setMOpen(true); };
    const del = (lk: string, id: string) => { setDItem({ lk, id }); setDOpen(true); };
    const confirmDel = () => { if (dItem) { const l = (sd[dItem.lk] as PropagacaoItem[]) || []; onSectionChange({ ...sd, [dItem.lk]: l.filter(i => i._id !== dItem.id) }); } setDOpen(false); setDItem(null); };

    const saveModal = () => {
        if (!ei?.especies) { alert('Informe a espécie/cultivar.'); return; }
        if (!listKey) return;
        const l = Array.isArray(sd[listKey]) ? [...(sd[listKey] as PropagacaoItem[])] : [];
        const idx = l.findIndex(i => i._id === ei._id);
        if (idx >= 0) l[idx] = ei; else l.push(ei);
        onSectionChange({ ...sd, [listKey]: l }); setMOpen(false); setEi(null);
    };

    const renderCards = (lk: string) => {
        const list = (sd[lk] as PropagacaoItem[]) || [];
        if (!list.length) return (
            <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Sprout size={48} className="mx-auto text-gray-400 mb-2" /><p className="text-gray-500">Nenhum item cadastrado.</p>
                <button type="button" onClick={() => addNew(lk)} className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm text-green-700 hover:bg-green-50 rounded-md"><PlusCircle size={16} />Adicionar</button>
            </div>
        );
        return (<div className="flex flex-col gap-2">
            {list.map(it => <PropagacaoCard key={it._id} item={it} onEdit={() => edit(lk, it)} onDelete={() => del(lk, it._id)} />)}
            <button type="button" onClick={() => addNew(lk)} className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-sm text-green-700 border border-green-300 hover:bg-green-50 rounded-md self-start"><PlusCircle size={16} />Adicionar Outro</button>
        </div>);
    };

    return (
        <SectionShell sectionLabel="Seção 9" title="Propagação Vegetal">
            <div className="flex flex-col gap-3">
                <AP title="9.1. Origem das sementes/mudas (Produção Orgânica)" defaultOpen>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3 text-sm text-amber-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>Atenção: O uso de sementes não orgânicas requer justificativa e autorização prévia.</span></div>
                    <p className="text-sm text-gray-500 mb-3">Descreva a procedência de todas as espécies cultivadas no sistema orgânico.</p>
                    {renderCards('sementes_mudas_organicas')}
                </AP>
                <AP title="9.2. Tratamento das sementes/mudas"><textarea name="tratamento_sementes_mudas" placeholder="Especifique se houver tratamento" value={sd.tratamento_sementes_mudas?.tratamento_sementes_mudas || ''} onChange={hc} rows={3} className={taCls} /></AP>
                <AP title="9.3. Manejo de produção própria"><textarea name="manejo_producao_propria" placeholder="Composição do substrato e tratamentos" value={sd.manejo_producao_propria?.manejo_producao_propria || ''} onChange={hc} rows={3} className={taCls} /></AP>
                <AP title="9.4. Aquisição para Cultivo Paralelo (Não Orgânico)"><p className="text-sm text-gray-500 mb-3">Registro exclusivo para insumos destinados a áreas de cultivo convencional/paralelo.</p>{renderCards('sementes_mudas_nao_organicas')}</AP>
                <AP title="9.5. Postura sobre transgênicos (Orgânico)"><textarea name="postura_uso_materiais_transgenicos_organica" value={sd.postura_uso_materiais_transgenicos_organica?.postura_uso_materiais_transgenicos_organica || ''} onChange={hc} rows={3} className={taCls} /></AP>
                <AP title="9.6. Cuidados com transgênicos (Não Orgânico)"><textarea name="cuidados_uso_materiais_transgenicos_nao_organica" value={sd.cuidados_uso_materiais_transgenicos_nao_organica?.cuidados_uso_materiais_transgenicos_nao_organica || ''} onChange={hc} rows={3} className={taCls} /></AP>
            </div>

            {mOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 bg-green-600 text-white rounded-t-xl"><h3 className="text-lg font-bold">{ei?._id ? 'Editar Item' : 'Novo Item'}</h3><button type="button" onClick={() => setMOpen(false)} className="p-1 hover:bg-white/20 rounded"><X size={20} /></button></div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={lCls}>Tipo</label><select value={ei?.tipo || 'semente'} onChange={e => setEi(p => p ? { ...p, tipo: e.target.value } : null)} className={iCls}>{TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
                        <div><label className={lCls}>Data da Compra</label><input type="date" value={ei?.data_compra ? ei.data_compra.split('T')[0] : ''} onChange={e => setEi(p => p ? { ...p, data_compra: e.target.value } : null)} className={iCls} /></div>
                    </div>
                    <div><label className={lCls}>Espécie / Cultivar *</label><input placeholder="Ex: Alface Crespa" required value={ei?.especies || ''} onChange={e => setEi(p => p ? { ...p, especies: e.target.value } : null)} className={iCls} /></div>
                    <div><label className={lCls}>Origem (Fornecedor)</label><input placeholder="Ex: Sementes Isla" value={ei?.origem || ''} onChange={e => setEi(p => p ? { ...p, origem: e.target.value } : null)} className={iCls} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={lCls}>Quantidade</label><input placeholder="Ex: 50g" value={ei?.quantidade || ''} onChange={e => setEi(p => p ? { ...p, quantidade: e.target.value } : null)} className={iCls} /></div>
                        {listKey === 'sementes_mudas_organicas' && <div><label className={lCls}>Certificação Orgânica?</label><div className="flex gap-4 mt-2"><label className="flex items-center gap-1.5 cursor-pointer text-sm"><input type="radio" checked={ei?.sistema_organico === true} onChange={() => setEi(p => p ? { ...p, sistema_organico: true } : null)} className="w-4 h-4 accent-green-600" />Sim</label><label className="flex items-center gap-1.5 cursor-pointer text-sm"><input type="radio" checked={ei?.sistema_organico === false} onChange={() => setEi(p => p ? { ...p, sistema_organico: false } : null)} className="w-4 h-4" />Não</label></div></div>}
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200"><button type="button" onClick={() => setMOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button><button type="button" onClick={saveModal} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">Salvar</button></div>
            </div></div>)}

            {dOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                <div className="px-5 py-4 border-b border-gray-200"><h3 className="text-lg font-bold text-gray-800">Confirmar Exclusão</h3></div>
                <div className="px-5 py-4"><p className="text-sm text-gray-600">Remover este item? Ação irreversível.</p></div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200"><button type="button" onClick={() => { setDOpen(false); setDItem(null) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button><button type="button" onClick={confirmDel} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">Excluir</button></div>
            </div></div>)}
        </SectionShell>
    );
};

export default Secao9MUI;
