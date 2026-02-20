// src/components/PmoForm/Secao10.tsx — Zero MUI
import React, { useState } from 'react';
import { Bug, Droplets, Pencil, Trash2, ChevronDown, ChevronUp, X, Plus } from 'lucide-react';
import SectionContainer from '../Common/SectionContainer';

export interface FitossanidadeItem {
  id?: string; _id?: string; produto_ou_manejo: string; alvo_principal: string;
  qual_praga_doenca?: string; dosagem: string; dose_valor?: string; dose_unidade?: string;
  quando: string; procedencia: string; composicao: string; marca: string; onde?: string;
}

const DOSE_UNITS = [
  { v: 'ml/litro', l: 'ml / Litro' }, { v: '%', l: '% (Proporção)' }, { v: 'l/ha', l: 'L / Hectare' },
  { v: 'kg/ha', l: 'Kg / Hectare' }, { v: 'g/m²', l: 'g/m²' }, { v: 'ml/m²', l: 'ml/m²' },
  { v: 'kg/cova', l: 'kg/cova' }, { v: 'g/planta', l: 'g/planta' },
];
const iCls = "w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500";
const lCls = "text-xs font-medium text-gray-600 mb-1 block";

const FCard: React.FC<{ item: FitossanidadeItem; onEdit: () => void; onDelete: () => void }> = ({ item, onEdit, onDelete }) => {
  const [exp, setExp] = useState(false);
  if (!item) return null;
  const d = item.dose_valor && item.dose_unidade ? `${item.dose_valor} ${item.dose_unidade}` : item.dosagem;
  return (
    <div className="rounded-lg border-l-[6px] border-l-amber-400 border border-gray-200 bg-white mb-2 shadow-sm">
      <div className="p-3">
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-100 text-amber-500"><Bug size={20} /></div>
            <div><h4 className="font-bold text-gray-800 leading-tight">{item.produto_ou_manejo || 'Não informado'}</h4><p className="text-sm text-gray-500">Alvo: <strong>{item.alvo_principal || item.qual_praga_doenca || 'N/I'}</strong></p></div>
          </div>
          <div className="flex">
            <button onClick={onEdit} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
            <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {item.onde && <span className="text-xs px-2 py-0.5 border border-gray-300 rounded-full text-gray-600">Cultura: {item.onde}</span>}
          {d && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full"><Droplets size={12} />{d}</span>}
        </div>
        <div className="mt-2">
          <button onClick={() => setExp(!exp)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">{exp ? 'Ocultar' : 'Ver detalhes'}{exp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          {exp && <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm space-y-1.5">{item.quando && <div><strong>Quando:</strong> {item.quando}</div>}{item.procedencia && <div><strong>Procedência:</strong> {item.procedencia}</div>}{item.composicao && <div><strong>Composição:</strong> {item.composicao}</div>}{item.marca && <div><strong>Marca:</strong> {item.marca}</div>}</div>}
        </div>
      </div>
    </div>
  );
};

interface Secao10Props { data: any; onSectionChange: (d: any) => void; }

const Secao10MUI: React.FC<Secao10Props> = ({ data, onSectionChange }) => {
  const items: FitossanidadeItem[] = Array.isArray(data?.lista_fitossanidade) ? data.lista_fitossanidade : [];
  const [mOpen, setMOpen] = useState(false);
  const [ei, setEi] = useState<FitossanidadeItem | null>(null);
  const [dOpen, setDOpen] = useState(false);
  const [dId, setDId] = useState<string | null>(null);

  const sv = (ni: any[]) => onSectionChange({ ...data, lista_fitossanidade: ni });
  const addNew = () => { setEi({ _id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, produto_ou_manejo: '', alvo_principal: '', dosagem: '', dose_valor: '', dose_unidade: 'ml/litro', quando: '', procedencia: '', composicao: '', marca: '' }); setMOpen(true); };
  const edit = (it: FitossanidadeItem) => { setEi({ ...it }); setMOpen(true); };
  const del = (id: string) => { setDId(id); setDOpen(true); };
  const confirmDel = () => { if (dId) sv(items.filter(i => (i._id || i.id) !== dId)); setDOpen(false); setDId(null); };

  const saveModal = () => {
    if (!ei) return;
    if (!ei.produto_ou_manejo) { alert('Informe o produto ou manejo.'); return; }
    const idx = items.findIndex(i => (i._id === ei._id) || (i.id && i.id === ei.id));
    const ni = [...items];
    if (ei.dose_valor && ei.dose_unidade) ei.dosagem = `${ei.dose_valor} ${ei.dose_unidade}`;
    if (idx >= 0) ni[idx] = ei; else ni.push(ei);
    sv(ni); setMOpen(false); setEi(null);
  };
  const fc = (f: keyof FitossanidadeItem, v: any) => { if (ei) setEi({ ...ei, [f]: v }); };

  const applySug = (s: any) => {
    const nome = s.produto || s.insumo || s.descricao || s.nome || '';
    sv([...items, { _id: `row_${Date.now()}_sug`, produto_ou_manejo: nome || 'Sugerido pelo Robô', alvo_principal: s.alvo_praga_doenca || s.alvo_principal || s.praga_doenca || '', dose_valor: String(s.dose_valor || ''), dose_unidade: s.dose_unidade || 'ml/litro', dosagem: s.dose_valor && s.dose_unidade ? `${s.dose_valor} ${s.dose_unidade}` : '', quando: '', procedencia: s.procedencia || s.origem || '', composicao: '', marca: '', onde: s.cultura || s.onde || '' } as FitossanidadeItem]);
  };

  return (
    <>
      <SectionContainer title="Manejo Fitossanitário (Pragas e Doenças)" onAdd={addNew} addButtonLabel="Adicionar Manejo" isEmpty={items.length === 0} emptyMessage="Nenhum manejo registrado." icon={<Bug size={48} className="text-gray-400" />} sectionId={10} onApplySuggestion={applySug}>
        <div className="flex flex-col">
          {items.map((it, i) => <FCard key={it._id || it.id || i} item={it} onEdit={() => edit(it)} onDelete={() => del(it._id || it.id || '')} />)}
          <button onClick={addNew} className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-sm text-amber-700 border border-dashed border-amber-300 hover:bg-amber-50 rounded-md self-start font-semibold"><Plus size={16} />Adicionar Outro</button>
        </div>
      </SectionContainer>

      {mOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200"><h3 className="text-lg font-bold text-gray-800">{ei?.produto_ou_manejo ? 'Editar Manejo' : 'Novo Manejo'}</h3><button onClick={() => setMOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button></div>
        <div className="p-5"><p className="text-sm text-gray-500 mb-4">Preencha as informações sobre o produto ou técnica.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className={lCls}>Produto ou Manejo *</label><input className={iCls} required value={ei?.produto_ou_manejo || ''} onChange={e => fc('produto_ou_manejo', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={lCls}>Alvo Principal</label><input className={iCls} value={ei?.alvo_principal || ''} onChange={e => fc('alvo_principal', e.target.value)} /></div>
            <div><label className={lCls}>Dose (Valor)</label><input className={iCls} type="number" value={ei?.dose_valor || ''} onChange={e => fc('dose_valor', e.target.value)} /></div>
            <div><label className={lCls}>Unidade</label><select className={iCls} value={ei?.dose_unidade || 'ml/litro'} onChange={e => fc('dose_unidade', e.target.value)}>{DOSE_UNITS.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}</select></div>
            <div><label className={lCls}>Quando?</label><input className={iCls} value={ei?.quando || ''} onChange={e => fc('quando', e.target.value)} /></div>
            <div><label className={lCls}>Procedência</label><input className={iCls} value={ei?.procedencia || ''} onChange={e => fc('procedencia', e.target.value)} /></div>
            <div><label className={lCls}>Marca</label><input className={iCls} value={ei?.marca || ''} onChange={e => fc('marca', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={lCls}>Composição</label><textarea className={`${iCls} resize-y`} rows={3} value={ei?.composicao || ''} onChange={e => fc('composicao', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200"><button onClick={() => setMOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button><button onClick={saveModal} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 font-medium">Salvar</button></div>
      </div></div>)}

      {dOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200"><h3 className="text-lg font-bold text-gray-800">Confirmar Exclusão</h3></div>
        <div className="px-5 py-4"><p className="text-sm text-gray-600">Remover este manejo? Ação irreversível.</p></div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200"><button onClick={() => { setDOpen(false); setDId(null) }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button><button onClick={confirmDel} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">Excluir</button></div>
      </div></div>)}
    </>
  );
};

export default Secao10MUI;