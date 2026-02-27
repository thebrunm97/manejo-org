// src/components/admin/KnowledgeBaseTab.tsx

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, BookOpen, Hash, Calendar } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface KnowledgeDocument {
    id: string;
    filename: string;
    title?: string;
    total_chunks: number;
    summary: string | null;
    created_at: string;
}

const KnowledgeBaseTab: React.FC = () => {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDocuments = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('knowledge_documents')
                    .select('id, filename, title, summary, total_chunks, created_at')
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

    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
                <Loader2 size={36} className="animate-spin text-slate-300 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Carregando documentos...
                </p>
            </div>
        );
    }

    // Empty State
    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
                <div className="p-5 bg-slate-100 rounded-2xl mb-6">
                    <BookOpen size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-500 mb-2">
                    Nenhum documento ingerido
                </h3>
                <p className="text-sm text-slate-400 font-medium max-w-md text-center leading-relaxed">
                    Execute o script <code className="px-1.5 py-0.5 bg-slate-100 rounded-md text-xs font-mono text-slate-500">treinar_especialista.py</code> para
                    alimentar a base de conhecimento do bot com documentos PDF.
                </p>
            </div>
        );
    }

    // Populated State
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header info */}
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {documents.length} documento{documents.length !== 1 ? 's' : ''} na base
                </p>
            </div>

            {/* Document Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {documents.map((doc) => (
                    <div
                        key={doc.id}
                        className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm shadow-slate-200/50 group hover:border-slate-200 hover:shadow-md transition-all duration-300"
                    >
                        {/* Card Header */}
                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl shrink-0">
                                <FileText size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-black text-slate-800 truncate" title={doc.title ? doc.title : doc.filename}>
                                    {doc.title ? doc.title : doc.filename}
                                </h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5" title={doc.filename}>
                                    {doc.filename}
                                </p>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        <Hash size={10} />
                                        {doc.total_chunks} chunks
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                        <Calendar size={10} />
                                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/50">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Resumo da IA
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                {doc.summary || 'Resumo não disponível.'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KnowledgeBaseTab;
