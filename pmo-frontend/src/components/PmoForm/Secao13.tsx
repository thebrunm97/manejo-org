// src/components/PmoForm/Secao13.tsx — Zero MUI
import React, { ChangeEvent, useState } from 'react';
import { ChevronDown, PlusCircle, Trash2 } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import CheckboxGroupMUI from './CheckboxGroup';
import TabelaDinamica, { TableColumn } from './TabelaDinamica';

interface NutricaoItem { animal?: string; identificacao_ingrediente?: string; origem_transgenica?: boolean | null; descricao?: string; procedencia?: string; frequencia?: string; quantidade?: string; }
interface AlimentoItem { alimento?: string;[key: string]: any; }
interface Secao13Data { tecnicas_melhoria_pastos?: string; tecnicas_melhoria_pastos_outros?: string; reproducao_animais?: string; reproducao_animais_outros?: string; aquisicao_animais?: any; evolucao_plantel?: any[]; nutricao_animal?: NutricaoItem[]; plano_anual_alimentacao_animal?: AlimentoItem[]; alimentacao_mamiferos_jovens?: { alimentacao_mamiferos_jovens?: string }; bem_estar_animais?: string; manejo_sanitario_animal?: any;[key: string]: any; }
interface Secao13MUIProps { data: Secao13Data | null | undefined; onSectionChange: (d: Secao13Data) => void; }

const inputCls = "w-full border-b border-gray-300 bg-transparent py-1 text-sm focus:border-green-500 focus:outline-none";
const labelCls = "text-xs font-medium text-gray-600 mb-1 block";
const textareaCls = "w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-y";

const AP: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [o, setO] = useState(defaultOpen);
    return (<div className="border border-gray-200 rounded-lg overflow-hidden"><button onClick={() => setO(!o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"><span className="font-bold text-sm text-gray-800">{title}</span><ChevronDown size={18} className={`text-gray-500 transition-transform ${o ? 'rotate-180' : ''}`} /></button>{o && <div className="p-4">{children}</div>}</div>);
};

// Sub: Tabela Nutrição Animal
const TabelaNutricao: React.FC<{ data: NutricaoItem[] | undefined; onDataChange: (d: NutricaoItem[]) => void }> = ({ data, onDataChange }) => {
    const sd = Array.isArray(data) ? data : [];
    const ch = (i: number, f: string, v: any) => { const n = [...sd]; n[i] = { ...n[i], [f]: v }; onDataChange(n); };
    const add = () => onDataChange([...sd, { animal: '', identificacao_ingrediente: '', origem_transgenica: null, descricao: '', procedencia: '', frequencia: '', quantidade: '' }]);
    const rem = (i: number) => onDataChange(sd.filter((_, x) => x !== i));
    return (
        <div>
            <p className="text-sm text-gray-500 mb-2">*Em caso de alimentação externa, informe se provém de sistema orgânico.</p>
            <div className="border border-gray-200 rounded-lg overflow-auto">
                <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b border-gray-200">
                        {['Animal', 'Ingrediente', 'Transgênica?', 'Descrição', 'Procedência', 'Frequência', 'Quantidade', 'Ação'].map(h => <th key={h} className="px-2 py-2 text-left font-bold text-gray-700">{h}</th>)}
                    </tr></thead>
                    <tbody>{sd.map((it, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1"><input className={inputCls} value={it.animal || ''} onChange={e => ch(i, 'animal', e.target.value)} /></td>
                            <td className="px-2 py-1"><input className={inputCls} value={it.identificacao_ingrediente || ''} onChange={e => ch(i, 'identificacao_ingrediente', e.target.value)} /></td>
                            <td className="px-2 py-1"><div className="flex items-center gap-1 whitespace-nowrap text-xs"><label className="flex items-center gap-0.5"><input type="radio" checked={it.origem_transgenica === true} onChange={() => ch(i, 'origem_transgenica', true)} className="w-3 h-3" />Sim</label><label className="flex items-center gap-0.5"><input type="radio" checked={it.origem_transgenica === false} onChange={() => ch(i, 'origem_transgenica', false)} className="w-3 h-3" />Não</label></div></td>
                            <td className="px-2 py-1"><input className={inputCls} value={it.descricao || ''} onChange={e => ch(i, 'descricao', e.target.value)} /></td>
                            <td className="px-2 py-1"><input className={inputCls} value={it.procedencia || ''} onChange={e => ch(i, 'procedencia', e.target.value)} /></td>
                            <td className="px-2 py-1"><input className={inputCls} value={it.frequencia || ''} onChange={e => ch(i, 'frequencia', e.target.value)} /></td>
                            <td className="px-2 py-1"><input className={inputCls} value={it.quantidade || ''} onChange={e => ch(i, 'quantidade', e.target.value)} /></td>
                            <td className="px-2 py-1 text-center"><button onClick={() => rem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <button onClick={add} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-md"><PlusCircle size={16} />Adicionar Nutrição</button>
        </div>
    );
};

// Sub: Plano Anual Alimentação
const PlanoAnual: React.FC<{ data: AlimentoItem[] | undefined; onDataChange: (d: AlimentoItem[]) => void }> = ({ data, onDataChange }) => {
    const isMobile = useIsMobile(640);
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const sd = Array.isArray(data) ? data : [];
    const ch = (i: number, f: string, v: any) => { const n = [...sd]; n[i] = { ...n[i], [f]: v }; onDataChange(n); };
    const add = () => onDataChange([...sd, { alimento: '', Jan: false, Fev: false, Mar: false, Abr: false, Mai: false, Jun: false, Jul: false, Ago: false, Set: false, Out: false, Nov: false, Dez: false }]);
    const rem = (i: number) => onDataChange(sd.filter((_, x) => x !== i));

    if (isMobile) return (
        <div>{sd.map((it, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2 relative shadow-sm">
                <button onClick={() => rem(i)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                <div><label className={labelCls}>Alimento</label><input className="w-full border border-gray-300 rounded-md p-2 text-sm" value={it.alimento || ''} onChange={e => ch(i, 'alimento', e.target.value)} /></div>
                <p className="text-xs text-gray-500 mt-2 mb-1">Marque os meses:</p>
                <div className="grid grid-cols-4 gap-1">{meses.map(m => <label key={m} className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={it[m] || false} onChange={e => ch(i, m, e.target.checked)} className="w-3.5 h-3.5 accent-green-600" />{m}</label>)}</div>
            </div>
        ))}<button onClick={add} className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-md"><PlusCircle size={16} />Adicionar Alimento</button></div>
    );

    return (
        <div>
            <div className="border border-gray-200 rounded-lg overflow-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-2 py-2 text-left font-bold text-gray-700" style={{ width: '25%' }}>Alimento</th>{meses.map(m => <th key={m} className="px-1 py-2 text-center font-bold text-gray-700">{m}</th>)}<th className="px-2 py-2 text-center font-bold text-gray-700">Ação</th></tr></thead>
                    <tbody>{sd.map((it, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1"><input className={inputCls} value={it.alimento || ''} onChange={e => ch(i, 'alimento', e.target.value)} /></td>
                            {meses.map(m => <td key={m} className="text-center"><input type="checkbox" checked={it[m] || false} onChange={e => ch(i, m, e.target.checked)} className="w-4 h-4 accent-green-600" /></td>)}
                            <td className="text-center"><button onClick={() => rem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <button onClick={add} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-md"><PlusCircle size={16} />Adicionar Alimento</button>
        </div>
    );
};

const Secao13MUI: React.FC<Secao13MUIProps> = ({ data, onSectionChange }) => {
    const sd = data || {};
    const hc = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onSectionChange({ ...sd, [e.target.name]: e.target.value });
    const hcb = (fn: string, nv: string) => onSectionChange({ ...sd, [fn]: nv });
    const hnc = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onSectionChange({ ...sd, [e.target.name]: { [e.target.name]: e.target.value } });
    const hms = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onSectionChange({ ...sd, manejo_sanitario_animal: { ...sd.manejo_sanitario_animal, [e.target.name]: { [e.target.name]: e.target.value } } });

    const colEvo: TableColumn[] = [{ id: 'tipo_animal', label: 'Tipo de animal', type: 'text' }, { id: 'numero_atual', label: 'Nº atual', type: 'number' }, { id: 'em_1_ano', label: 'Em 1 ano', type: 'number' }, { id: 'em_3_anos', label: 'Em 3 anos', type: 'number' }, { id: 'em_5_anos', label: 'Em 5 anos', type: 'number' }];
    const colTrat: TableColumn[] = [{ id: 'animal_lote', label: 'Animal/Lote', type: 'text' }, { id: 'diagnostico', label: 'Diagnóstico', type: 'text' }, { id: 'tratamento', label: 'Tratamento', type: 'text' }, { id: 'periodo_carencia', label: 'Período de Carência', type: 'text' }];

    return (
        <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Seção 13: Produção Animal</h2>
            <AP title="13.1. Técnicas para melhoria de pastos" defaultOpen><CheckboxGroupMUI title="" options={['Pastejo rotacionado', 'Consorciação de pastagens', 'Rotação de culturas', 'Adubação orgânica', 'Uso de quebra-vento', 'Plantio de árvores nativas', 'Integração lavoura/pecuária', 'Outros - citar:']} selectedString={sd.tecnicas_melhoria_pastos} onSelectionChange={v => hcb('tecnicas_melhoria_pastos', v)} otherOption="Outros - citar:" otherValue={sd.tecnicas_melhoria_pastos_outros} onOtherChange={hc} otherName="tecnicas_melhoria_pastos_outros" /></AP>
            <AP title="13.2. Como realiza a reprodução?"><CheckboxGroupMUI title="" options={['Compra animais de fora', 'Monta natural', 'Métodos artificiais', 'Outros - citar:']} selectedString={sd.reproducao_animais} onSelectionChange={v => hcb('reproducao_animais', v)} otherOption="Outros - citar:" otherValue={sd.reproducao_animais_outros} onOtherChange={hc} otherName="reproducao_animais_outros" /></AP>
            <AP title="13.4. Evolução do plantel"><TabelaDinamica columns={colEvo} data={sd.evolucao_plantel} onDataChange={nd => onSectionChange({ ...sd, evolucao_plantel: nd })} itemName="Tipo de Animal" /></AP>
            <AP title="13.5. Nutrição animal"><TabelaNutricao data={sd.nutricao_animal} onDataChange={nd => onSectionChange({ ...sd, nutricao_animal: nd })} /></AP>
            <AP title="13.6. Plano anual de alimentação"><PlanoAnual data={sd.plano_anual_alimentacao_animal} onDataChange={nd => onSectionChange({ ...sd, plano_anual_alimentacao_animal: nd })} /></AP>
            <AP title="13.7. Alimentação de mamíferos jovens"><textarea name="alimentacao_mamiferos_jovens" className={textareaCls} rows={3} value={sd.alimentacao_mamiferos_jovens?.alimentacao_mamiferos_jovens || ''} onChange={hnc} /></AP>
            <AP title="13.8. Bem-estar dos animais"><CheckboxGroupMUI title="" options={['Manejo adequado', 'Água de boa qualidade', 'Alimento farto', 'Instalações adequadas', 'Lotação adequada', 'Sombreamento']} selectedString={sd.bem_estar_animais} onSelectionChange={v => hcb('bem_estar_animais', v)} /></AP>
            <AP title="13.9. Manejo sanitário animal"><div className="flex flex-col gap-4"><div><label className={labelCls}>13.9.1. Promoção da saúde animal</label><textarea name="promocao_saude_animal" className={textareaCls} rows={3} value={sd.manejo_sanitario_animal?.promocao_saude_animal?.promocao_saude_animal || ''} onChange={hms} /></div><div><label className={labelCls}>13.9.2. Controle de vermes e parasitas</label><textarea name="controle_vermes_parasitas" className={textareaCls} rows={3} value={sd.manejo_sanitario_animal?.controle_vermes_parasitas?.controle_vermes_parasitas || ''} onChange={hms} /></div><TabelaDinamica label="13.9.3. Tratamentos realizados" columns={colTrat} data={sd.manejo_sanitario_animal?.tratamento_animais_doentes} onDataChange={nd => onSectionChange({ ...sd, manejo_sanitario_animal: { ...sd.manejo_sanitario_animal, tratamento_animais_doentes: nd } })} itemName="Tratamento" itemNoun="o" /></div></AP>
        </div>
    );
};

export default Secao13MUI;
