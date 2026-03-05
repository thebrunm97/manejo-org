import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
    CheckCircle,
    XCircle,
    Loader2,
    Clock,
    Database,
    AlertTriangle,
    RefreshCw,
    Search,
    Info,
    ArrowUpCircle,
    UploadCloud
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { uploadKnowledgePDF } from '../../services/ragService';
import { toast } from 'react-toastify';

interface IngestionJob {
    id: string;
    pmo_id: number | null;
    file_name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_chunks: number;
    processed_chunks: number;
    error_log: string | null;
    created_at: string;
    updated_at: string;
}

const KnowledgeMonitoringPage: React.FC = () => {
    const [jobs, setJobs] = useState<IngestionJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedError, setSelectedError] = useState<string | null>(null);
    const { profile } = useAuth();
    const [docCount, setDocCount] = useState<number | null>(null);

    const [isUploading, setIsUploading] = useState(false);

    // Fetch initial data
    const fetchJobs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ingestion_jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setJobs(data || []);
        } finally {
            setLoading(false);
        }

        // Fetch doc count for quota
        if (profile?.pmo_ativo_id) {
            try {
                const { data: docs, error: countError } = await supabase
                    .from('farm_documents')
                    .select('document_name')
                    .eq('pmo_id', profile.pmo_ativo_id);

                if (!countError && docs) {
                    const uniqueNames = new Set(docs.map(d => d.document_name));
                    setDocCount(uniqueNames.size);
                }
            } catch (err) {
                console.error('Error fetching doc count:', err);
            }
        }
    };

    useEffect(() => {
        fetchJobs();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('public:ingestion_jobs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'ingestion_jobs' },
                (payload) => {
                    console.log('Realtime Ingestion Update:', payload);

                    setJobs((currentJobs) => {
                        if (payload.eventType === 'INSERT') {
                            return [payload.new as IngestionJob, ...currentJobs];
                        }
                        if (payload.eventType === 'UPDATE') {
                            return currentJobs.map((job) =>
                                job.id === payload.new.id ? (payload.new as IngestionJob) : job
                            );
                        }
                        if (payload.eventType === 'DELETE') {
                            return currentJobs.filter((job) => job.id !== payload.old.id);
                        }
                        return currentJobs;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.pmo_ativo_id]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Por favor, selecione um arquivo PDF.');
            return;
        }

        setIsUploading(true);
        try {
            const result = await uploadKnowledgePDF(file, profile?.pmo_ativo_id || undefined);
            toast.success(`Upload aceito! Job ID: ${result.job_id}`);
            // Reset input so the same file can be uploaded again if needed
            e.target.value = '';
            // Refresh list to see the new pending job
            fetchJobs();
        } catch (error: any) {
            console.error('Erro no upload RAG:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Erro ao enviar arquivo.';
            toast.error(errorMsg);
        } finally {
            setIsUploading(false);
        }
    };

    const filteredJobs = jobs.filter(
        (job) =>
            job.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (job.pmo_id && job.pmo_id.toString().includes(searchTerm))
    );

    const getStatusBadge = (status: IngestionJob['status']) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Concluído
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Processando
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Falhou
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Pendente
                    </span>
                );
        }
    };

    const calculateProgress = (processed: number, total: number) => {
        if (total === 0) return 0;
        return Math.min(Math.round((processed / total) * 100), 100);
    };

    // Quota Stats
    const isPro = profile?.plan_tier === 'pro';
    const limit = 3;
    const usagePercent = isPro ? 0 : (docCount ? Math.min((docCount / limit) * 100, 100) : 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Database className="w-6 h-6 text-brand-500" />
                        Monitoramento de Ingestão (RAG)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Status em tempo real do processamento e vetorização de PDFs.
                    </p>
                </div>

                {/* Quota Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-4 shadow-sm min-w-[280px]">
                    <div className={`p-3 rounded-xl ${isPro ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                        {isPro ? <ArrowUpCircle size={24} /> : <Info size={24} />}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Cota de Documentos
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {isPro ? 'ILIMITADO' : `${docCount ?? 0} / ${limit}`}
                            </span>
                        </div>
                        {!isPro && (
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ease-out rounded-full ${usagePercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${usagePercent}%` }}
                                />
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-medium">
                            Plano: <span className={isPro ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{isPro ? 'Premium 💎' : 'Free 🌱'}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botão de Upload RAG */}
                    <label className={`
                        flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-500/20 cursor-pointer
                        ${isUploading ? 'opacity-50 cursor-wait' : ''}
                    `}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {isUploading ? 'Enviando...' : 'Ingerir PDF'}
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            onChange={handleUpload}
                            disabled={isUploading}
                        />
                    </label>

                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar arquivo ou PMO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white transition-all"
                        />
                    </div>
                    <button
                        onClick={fetchJobs}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        title="Recarregar"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">Carregando jobs...</p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Nenhum job encontrado</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                            Faça o upload de um documento na plataforma ou via bot para iniciar a vetorização.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documento</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">PMO ID</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">Progresso</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                {filteredJobs.map((job) => {
                                    const progress = calculateProgress(job.processed_chunks, job.total_chunks);

                                    return (
                                        <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="font-medium text-slate-900 dark:text-white truncate max-w-xs" title={job.file_name}>
                                                    {job.file_name}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                                    {job.id.substring(0, 8)}...
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                                    {job.pmo_id || 'Global'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                {getStatusBadge(job.status)}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                            {progress}%
                                                        </span>
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            {job.processed_chunks} / {job.total_chunks || '?'}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ease-out ${job.status === 'completed' ? 'bg-emerald-500' :
                                                                job.status === 'failed' ? 'bg-rose-500' :
                                                                    'bg-brand-500'
                                                                }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                                    {new Date(job.created_at).toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {new Date(job.created_at).toLocaleTimeString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                {job.status === 'failed' && job.error_log && (
                                                    <button
                                                        onClick={() => setSelectedError(job.error_log)}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors"
                                                        title="Ver log de erro"
                                                    >
                                                        <AlertTriangle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Error Modal */}
            {selectedError && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-rose-50/50 dark:bg-rose-900/10">
                            <h3 className="text-lg font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Log de Erro (Falha na Vetorização)
                            </h3>
                            <button
                                onClick={() => setSelectedError(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <pre className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-sm font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-800">
                                {selectedError}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                            <button
                                onClick={() => setSelectedError(null)}
                                className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeMonitoringPage;
