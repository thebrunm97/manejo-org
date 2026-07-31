import React, { useEffect, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle, FilePlus, Trash2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { ResponsiveModal } from '@/components/Common/ResponsiveModal';
import { toast } from 'react-toastify';

interface KnowledgeDocument {
    id: string;
    title: string;
    source_type: string;
    storage_path: string;
    created_at: string;
    current_live_version_id?: string;
    ingestion_job?: {
        status: string;
        step?: string;
        progress_pct?: number;
        error_log?: string;
    };
}

export const DocumentsPanel: React.FC = () => {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<string | null>(null);

    // Fetch documents and their latest job status
    const fetchDocuments = async () => {
        try {
            // Get documents via Supabase RPC or custom join if needed.
            // For MVP, calling the Go API endpoint `/api/v1/admin/knowledge/documents` would be ideal,
            // but we can also fetch directly from Supabase for simplicity if the API isn't fully wired to frontend yet.
            // Let's use direct Supabase calls with PostgREST joins.
            const { data, error } = await supabase
                .from('knowledge_documents')
                .select(`
                    id, title, source_type, storage_path, created_at, current_live_version_id,
                    ingestion_jobs (
                        status, step, progress_pct, error_log
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map to flat structure, taking the most recent job
            const mapped = data.map((d: any) => ({
                id: d.id,
                title: d.title,
                source_type: d.source_type,
                storage_path: d.storage_path,
                created_at: d.created_at,
                current_live_version_id: d.current_live_version_id,
                // Assuming ingestion_jobs is an array, we take the last one or the only one
                ingestion_job: d.ingestion_jobs && d.ingestion_jobs.length > 0 
                    ? d.ingestion_jobs[d.ingestion_jobs.length - 1] 
                    : undefined
            }));

            setDocuments(mapped);
        } catch (err: any) {
            console.error('Error fetching documents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
        // Setup polling every 5 seconds for job updates
        const interval = setInterval(fetchDocuments, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadError(null);

        try {
            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const storagePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('knowledge-docs')
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // 2. Call Go API to enqueue the ingestion job
            // We use fetch directly to the local Go server
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            const response = await fetch(`${apiUrl}/api/v1/admin/knowledge/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: In a real scenario, attach the JWT token here
                },
                body: JSON.stringify({
                    title: file.name,
                    source_type: file.type === 'application/pdf' ? 'PDF' : 'MARKDOWN',
                    storage_path: storagePath,
                    mime_type: file.type,
                    metadata: { original_name: file.name }
                })
            });

            if (!response.ok) {
                const resErr = await response.text();
                if (response.status === 409 || resErr.includes('already exists')) {
                    throw new Error('Já existe um documento com esse nome na base.');
                }
                throw new Error(`API Error: ${resErr}`);
            }

            // Instantly refresh list
            await fetchDocuments();

        } catch (err: any) {
            console.error('Upload failed:', err);
            setUploadError(err.message || 'Falha ao enviar arquivo');
        } finally {
            setUploading(false);
            // reset input
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteDocument = async (id: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            const response = await fetch(`${apiUrl}/api/v1/admin/knowledge/documents/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const resErr = await response.text();
                throw new Error(`Erro ao apagar: ${resErr}`);
            }
            toast.success('Documento apagado com sucesso!');
            setDocToDelete(null);
            await fetchDocuments();
        } catch (err: any) {
            console.error('Delete failed:', err);
            toast.error(err.message || 'Falha ao apagar documento');
        }
    };

    const renderJobStatus = (job?: KnowledgeDocument['ingestion_job']) => {
        if (!job) return <span className="text-gray-400 text-xs">Sem Job</span>;

        const statusColors: Record<string, string> = {
            pending: 'text-yellow-500 bg-yellow-500/10',
            extracting: 'text-blue-500 bg-blue-500/10',
            chunking: 'text-purple-500 bg-purple-500/10',
            embedding: 'text-indigo-500 bg-indigo-500/10',
            indexed: 'text-green-500 bg-green-500/10',
            failed: 'text-red-500 bg-red-500/10',
        };

        const colorClass = statusColors[job.status] || 'text-gray-500 bg-gray-500/10';

        return (
            <div className="flex flex-col gap-1">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block text-center ${colorClass}`}>
                    {job.status} {job.progress_pct !== undefined && job.status !== 'indexed' && job.status !== 'failed' ? `(${job.progress_pct}%)` : ''}
                </span>
                {job.step && job.status !== 'indexed' && (
                    <span className="text-[9px] text-gray-400 truncate max-w-[120px]">{job.step}</span>
                )}
                {job.status === 'failed' && job.error_log && (
                    <span className="text-[9px] text-red-400 truncate max-w-[120px]" title={job.error_log}>
                        {job.error_log}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header & Upload Action */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-serif font-bold text-agro-floresta">Acervo de Documentos</h3>
                    <p className="text-sm text-agro-floresta/60">Faça o upload de cartilhas (PDF) ou regras (Markdown) para a base do bot.</p>
                </div>
                
                <div>
                    <input 
                        type="file" 
                        id="knowledge-upload" 
                        className="hidden" 
                        accept=".pdf,.md,.txt"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                    <label 
                        htmlFor="knowledge-upload" 
                        className={`flex items-center gap-2 px-4 py-2 bg-agro-floresta text-agro-ouro rounded-xl shadow-md cursor-pointer hover:bg-agro-floresta/90 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span className="text-sm font-bold uppercase tracking-wider">
                            {uploading ? 'Enviando...' : 'Upload Documento'}
                        </span>
                    </label>
                </div>
            </div>

            {uploadError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertCircle size={18} />
                    <span className="text-sm">{uploadError}</span>
                </div>
            )}

            {/* Documents Table */}
            <div className="bg-white rounded-2xl border border-agro-ouro/20 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-agro-floresta/5 border-b border-agro-ouro/10">
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest">Documento</th>
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest">Tipo</th>
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest">Data Upload</th>
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest">Status (Job)</th>
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest">Versão Ativa</th>
                            <th className="p-4 text-xs font-black text-agro-floresta/40 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-agro-ouro/5">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center">
                                    <Loader2 size={24} className="animate-spin text-agro-floresta/30 mx-auto" />
                                </td>
                            </tr>
                        ) : documents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-agro-floresta/40">
                                        <FilePlus size={32} className="mb-3 opacity-50" />
                                        <p className="text-sm">Nenhum documento encontrado.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            documents.map(doc => (
                                <tr key={doc.id} className="hover:bg-agro-floresta/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-agro-floresta/10 text-agro-floresta rounded-lg">
                                                <FileText size={16} />
                                            </div>
                                            <span className="font-medium text-agro-floresta text-sm truncate max-w-[200px]" title={doc.title}>
                                                {doc.title}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-bold text-agro-floresta/60 bg-gray-100 px-2 py-1 rounded-md">
                                            {doc.source_type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-agro-floresta/60">
                                        {(() => {
                                            if (!doc.created_at) return '-';
                                            const date = new Date(doc.created_at);
                                            return date.getFullYear() > 2000 ? date.toLocaleDateString('pt-BR') : '-';
                                        })()}
                                    </td>
                                    <td className="p-4">
                                        {renderJobStatus(doc.ingestion_job)}
                                    </td>
                                    <td className="p-4">
                                        {doc.current_live_version_id ? (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                                LIVE
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                                                DRAFT
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => setDocToDelete(doc.id)}
                                            className="p-2 text-red-500/70 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Apagar Documento"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ResponsiveModal
                isOpen={!!docToDelete}
                onOpenChange={(open) => !open && setDocToDelete(null)}
                title="Apagar Documento"
                description="Tem certeza que deseja apagar este documento? Todos os embeddings, regras e jobs relacionados a ele serão removidos."
            >
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={() => setDocToDelete(null)}
                        className="px-4 py-2 text-sm font-bold text-agro-floresta bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => docToDelete && handleDeleteDocument(docToDelete)}
                        className="px-4 py-2 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm"
                    >
                        Sim, Apagar
                    </button>
                </div>
            </ResponsiveModal>
        </div>
    );
};
