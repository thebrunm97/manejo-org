// src/components/admin/KnowledgeBaseTab.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Loader2, BookOpen, Hash, Calendar, Search, Sparkles } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { cn } from '../../utils/cn';

interface KnowledgeDocument {
    id: string;
    filename: string;
    title?: string;
    total_chunks: number;
    summary: string | null;
    author?: string;
    created_at: string;
}

const KnowledgeBaseTab: React.FC = () => {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchDocuments = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('knowledge_documents')
                    .select('id, filename, title, summary, total_chunks, created_at, author')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching knowledge documents:', error);
                } else {
                    setDocuments(data || []);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, []);

    const filteredDocuments = useMemo(() => {
        if (!searchTerm) return documents;
        const lowTerm = searchTerm.toLowerCase();
        return documents.filter(doc => 
            doc.title?.toLowerCase().includes(lowTerm) ||
            doc.filename?.toLowerCase().includes(lowTerm) ||
            doc.summary?.toLowerCase().includes(lowTerm) ||
            doc.author?.toLowerCase().includes(lowTerm)
        );
    }, [documents, searchTerm]);

    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500 overflow-hidden">
                <Loader2 size={36} className="animate-spin text-agro-floresta/20 mb-4" />
                <p className="text-[10px] font-black text-agro-floresta/40 uppercase tracking-[0.2em] font-sans">
                    Sincronizando Base de Conhecimento…
                </p>
            </div>
        );
    }

    // Empty State (No documents total)
    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500 text-center px-4">
                <div className="p-8 bg-white/50 border border-agro-ouro/10 rounded-full mb-8 shadow-inner">
                    <BookOpen size={48} className="text-agro-floresta/10" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-agro-floresta mb-4 uppercase tracking-tight">
                    Acervo Vazio
                </h3>
                <p className="text-sm text-agro-floresta/40 font-medium max-w-sm leading-relaxed italic">
                    Execute a ingestão documental para alimentar a rede neural com diretrizes agronômicas específicas.
                </p>
                <div className="mt-8 bg-agro-floresta/5 px-6 py-3 rounded-2xl border border-agro-ouro/10 inline-flex items-center gap-3">
                    <span className="text-[9px] font-black text-agro-floresta/40 uppercase tracking-widest">Protocolo:</span>
                    <code className="text-[10px] font-mono font-bold text-agro-ouro">treinar_especialista.py</code>
                </div>
            </div>
        );
    }

    // Populated State
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Toolbar: Stats & Search */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-agro-floresta text-agro-ouro rounded-xl shadow-lg shadow-agro-floresta/10">
                        <Sparkles size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-agro-floresta uppercase tracking-[0.2em]">Acervo Consolidado</span>
                        <p className="text-xs font-bold text-agro-floresta/40 tabular-nums">
                            {documents.length} Volume{documents.length !== 1 ? 's' : ''} Catalogado{documents.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full lg:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-agro-floresta/30 group-focus-within:text-agro-ouro transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Pesquisar no acervo editorial…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-agro-ouro/10 rounded-2xl text-sm font-bold text-agro-floresta placeholder:text-agro-floresta/20 focus:outline-none focus:ring-2 focus:ring-agro-ouro/30 focus:border-agro-ouro/50 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Document Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredDocuments.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white/40 border border-dashed border-agro-ouro/20 rounded-[2.5rem]">
                        <p className="text-sm font-bold text-agro-floresta/40 italic">Nenhum volume corresponde à sua pesquisa.</p>
                    </div>
                ) : (
                    filteredDocuments.map((doc) => (
                        <div
                            key={doc.id}
                            className="bg-white rounded-[2.5rem] p-8 border border-agro-ouro/10 shadow-sm group hover:border-agro-ouro/30 hover:shadow-2xl hover:shadow-agro-floresta/5 transition-all duration-500 flex flex-col h-full active:scale-[0.98]"
                        >
                            {/* Card Header */}
                            <div className="flex items-start gap-5 mb-8">
                                <div className="p-4 bg-agro-floresta text-agro-ouro rounded-3xl shrink-0 shadow-lg shadow-agro-floresta/10 group-hover:bg-agro-ouro group-hover:text-white transition-all duration-500">
                                    <FileText size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-lg font-serif font-bold text-agro-floresta leading-tight break-words mb-3 uppercase tracking-tight group-hover:text-agro-ouro transition-colors" title={doc.title ? doc.title : doc.filename}>
                                        {doc.title ? doc.title : doc.filename}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-agro-ouro bg-agro-ouro/10 px-3 py-1.5 rounded-xl border border-agro-ouro/20 uppercase tracking-widest shadow-sm tabular-nums">
                                            <Hash size={10} />
                                            {doc.total_chunks} Segmentos
                                        </span>
                                        {doc.author && (
                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-agro-floresta bg-agro-floresta/5 px-3 py-1.5 rounded-xl border border-agro-floresta/10 uppercase tracking-widest shadow-sm">
                                                By: {doc.author}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Footer */}
                            <div className="mt-6 pt-6 border-t border-agro-ouro/5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-agro-floresta/40 uppercase tracking-widest">
                                    <Calendar size={12} className="text-agro-ouro" />
                                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(doc.created_at))}
                                </div>
                            </div>

                            {/* Summary Section */}
                            <div className="mt-8 bg-agro-creme/60 rounded-3xl p-6 border border-agro-ouro/5 relative overflow-hidden group-hover:bg-agro-ouro/5 transition-colors flex-1">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-agro-ouro/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
                                
                                <span className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-[0.15] rotate-12 transition-all">
                                    <Search size={48} className="text-agro-floresta" />
                                </span>

                                <p className="text-[10px] font-black text-agro-floresta/60 uppercase tracking-[0.2em] mb-4 font-sans">
                                    Resumo Analítico
                                </p>
                                <p className="text-[13px] text-agro-floresta/70 leading-relaxed font-medium italic">
                                    “{doc.summary || 'Síntese de inteligência pendente de geração.'}”
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default KnowledgeBaseTab;
