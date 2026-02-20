// src/pages/PmoDetailPage.tsx — Zero MUI
import React, { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PmoParaImpressao from './PmoParaImpressao';
import { ArrowLeft, Pencil, Printer, ChevronDown, Loader2, ExternalLink } from 'lucide-react';

interface Column { key: string; header: string; }
interface DetailItemProps { label: string; value?: ReactNode; bold?: boolean; }
interface DetailTableProps { title: string; items?: any[]; columns: Column[]; }

interface PmoFormData {
    secao_1_descricao_propriedade?: {
        dados_cadastrais?: { nome_produtor?: string; cpf?: string };
        area_propriedade?: { area_producao_organica_hectares?: number; area_producao_em_conversao_hectares?: number; area_producao_nao_organica_hectares?: number; area_total_propriedade_hectares?: number; };
    };
    secao_2_atividades_produtivas_organicas?: {
        producao_primaria_vegetal?: { produtos_primaria_vegetal?: any[] };
        producao_primaria_animal?: { animais_primaria_animal?: any[] };
    };
    secao_18_anexos?: { lista_anexos?: Array<{ nome_documento?: string; url_arquivo?: string }> };
}

interface Pmo { id: string; nome_identificador: string; status?: string; created_at: string; form_data: PmoFormData; }

const DetailItem: React.FC<DetailItemProps> = ({ label, value, bold }) => (
    <div>
        <span className="text-xs text-gray-500">{label}</span>
        <p className={`text-sm text-gray-900 ${bold ? 'text-lg font-bold' : ''}`}>{value || 'Não informado'}</p>
    </div>
);

const DetailTable: React.FC<DetailTableProps> = ({ title, items, columns }) => (
    <div className="mt-3">
        <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
        {items && items.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50"><tr>{columns.map(col => (
                            <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.header}</th>
                        ))}</tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">{items.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">{columns.map(col => (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item[col.key] || '-'}</td>
                            ))}</tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        ) : (
            <p className="text-sm text-gray-400 italic">Nenhum item cadastrado.</p>
        )}
    </div>
);

// AccordionPanel helper
const AP: React.FC<{ title: string; defaultOpen?: boolean; children: ReactNode }> = ({ title, defaultOpen = false, children }) => {
    const [o, setO] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setO(!o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <span className="font-semibold text-gray-800">{title}</span>
                <ChevronDown size={18} className={`text-gray-500 transition-transform ${o ? 'rotate-180' : ''}`} />
            </button>
            {o && <div className="p-4">{children}</div>}
        </div>
    );
};

const PmoDetailPageMUI: React.FC = () => {
    const { pmoId } = useParams<{ pmoId: string }>();
    const navigate = useNavigate();
    const [pmo, setPmo] = useState<Pmo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPmo = async () => {
            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase.from('pmos').select('*').eq('id', pmoId).single();
                if (fetchError) throw fetchError;
                setPmo(data);
            } catch (err) {
                setError('Não foi possível carregar os detalhes deste PMO.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchPmo();
    }, [pmoId]);

    if (isLoading) return <div className="flex justify-center py-10"><Loader2 size={32} className="animate-spin text-green-600" /></div>;
    if (error) return <p className="text-center text-red-600 py-10">{error}</p>;
    if (!pmo) return <p className="text-center text-gray-500 py-10">Plano de Manejo não encontrado.</p>;

    const d = pmo.form_data || {};

    return (
        <div className="p-3 flex flex-col min-h-full pb-10">
            <PmoParaImpressao pmoData={pmo} />

            <div className="no-print">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">{pmo.nome_identificador}</h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"><ArrowLeft size={16} />Voltar</button>
                        <button type="button" onClick={() => navigate(`/pmo/${pmoId}/editar`)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"><Pencil size={16} />Editar</button>
                        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"><Printer size={16} />Exportar PDF</button>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <AP title="Informações Gerais" defaultOpen>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DetailItem label="Status" value={<span className="inline-flex px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{pmo.status || 'RASCUNHO'}</span>} />
                            <DetailItem label="Criado em" value={new Date(pmo.created_at).toLocaleString('pt-BR')} />
                            <DetailItem label="Produtor" value={d.secao_1_descricao_propriedade?.dados_cadastrais?.nome_produtor} />
                            <DetailItem label="CPF" value={d.secao_1_descricao_propriedade?.dados_cadastrais?.cpf} />
                        </div>
                    </AP>

                    <AP title="Áreas da Propriedade (ha)">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <DetailItem label="Área Orgânica" value={d.secao_1_descricao_propriedade?.area_propriedade?.area_producao_organica_hectares} />
                            <DetailItem label="Área em Conversão" value={d.secao_1_descricao_propriedade?.area_propriedade?.area_producao_em_conversao_hectares} />
                            <DetailItem label="Área Não-Orgânica" value={d.secao_1_descricao_propriedade?.area_propriedade?.area_producao_nao_organica_hectares} />
                        </div>
                        <hr className="my-3 border-gray-200" />
                        <DetailItem label="Área Total" value={d.secao_1_descricao_propriedade?.area_propriedade?.area_total_propriedade_hectares} bold />
                    </AP>

                    <AP title="Atividades Produtivas Orgânicas">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailTable title="Produção Vegetal" items={d.secao_2_atividades_produtivas_organicas?.producao_primaria_vegetal?.produtos_primaria_vegetal} columns={[{ key: 'produto', header: 'Produto' }, { key: 'producao_esperada_ano', header: 'Produção Esperada/Ano' }]} />
                            <DetailTable title="Produção Animal" items={d.secao_2_atividades_produtivas_organicas?.producao_primaria_animal?.animais_primaria_animal} columns={[{ key: 'especie', header: 'Espécie' }, { key: 'n_de_animais', header: 'Nº de Animais' }]} />
                        </div>
                    </AP>

                    <AP title="Anexos">
                        {(d.secao_18_anexos?.lista_anexos && d.secao_18_anexos.lista_anexos.length > 0) ? (
                            <ul className="divide-y divide-gray-200">
                                {d.secao_18_anexos.lista_anexos.map((anexo, i) => (
                                    <li key={i} className="py-2">
                                        <p className="text-sm font-medium text-gray-800">{anexo.nome_documento}</p>
                                        <a href={anexo.url_arquivo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={12} />{anexo.url_arquivo}</a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400">Nenhum anexo encontrado.</p>
                        )}
                    </AP>
                </div>
            </div>
        </div>
    );
};

export default PmoDetailPageMUI;
