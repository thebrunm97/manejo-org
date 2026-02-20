// src/components/PmoForm/Secao18.tsx — Zero MUI
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useMediaManager } from '../../hooks/media/useMediaManager';
import { Camera, Paperclip, FileText, CheckCircle, Link as LinkIcon, Trash2, Loader2 } from 'lucide-react';

interface Anexo { nome_documento: string; descricao?: string; url_arquivo: string; path_arquivo: string; }
interface Secao18Data { lista_anexos?: Anexo[];[key: string]: any; }
interface Secao18MUIProps { data: Secao18Data | null | undefined; onSectionChange: (d: Secao18Data) => void; }

const inputCls = "w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";

const Secao18MUI: React.FC<Secao18MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const anexos: Anexo[] = Array.isArray(safeData.lista_anexos) ? safeData.lista_anexos : [];
    const { user } = useAuth();
    const { currentAsset, isUploading, uploadError, selectImage, selectDocument, uploadAsset, clearAsset } = useMediaManager();
    const [docName, setDocName] = useState('');
    const [docDescription, setDocDescription] = useState('');

    React.useEffect(() => {
        if (currentAsset && !docName) {
            const parts = currentAsset.name.split('.');
            if (parts.length > 1) parts.pop();
            setDocName(parts.join('.'));
        }
    }, [currentAsset]);

    const handleConfirmUpload = async () => {
        if (!currentAsset) return;
        if (!docName.trim()) { alert('O nome do documento é obrigatório.'); return; }
        if (!user) { alert('Usuário não autenticado.'); return; }
        const publicUrl = await uploadAsset(user.id);
        if (publicUrl) {
            const fileExt = currentAsset.name.split('.').pop();
            const fn = publicUrl.split('/').pop() || `${Date.now()}.${fileExt}`;
            const novoAnexo: Anexo = { nome_documento: docName, descricao: docDescription, url_arquivo: publicUrl, path_arquivo: `${user.id}/${fn}` };
            onSectionChange({ ...safeData, lista_anexos: [...anexos, novoAnexo] });
            handleCancel();
        }
    };

    const handleCancel = () => { clearAsset(); setDocName(''); setDocDescription(''); };

    const removerAnexo = async (index: number, path: string) => {
        try {
            const { error } = await supabase.storage.from('anexos-pmos').remove([path]);
            if (error) throw error;
            onSectionChange({ ...safeData, lista_anexos: anexos.filter((_, i) => i !== index) });
        } catch (err: any) { console.error('Erro ao remover anexo:', err); alert('Falha ao remover o anexo: ' + err.message); }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Seção 18: Anexos</h2>
            <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Adicionar Novo Documento</h3>
                {!currentAsset ? (
                    <div className="flex flex-col sm:flex-row gap-3 my-3">
                        <button onClick={() => selectImage('camera')} className="flex-1 flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors"><Camera size={20} />Adicionar Foto</button>
                        <button onClick={selectDocument} className="flex-1 flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors"><Paperclip size={20} />Anexar Documento</button>
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 my-3">
                        <div className="flex items-center gap-3 mb-4">
                            {currentAsset.type === 'image' ? <img src={currentAsset.uri} alt="preview" className="w-14 h-14 rounded object-cover" /> : <FileText size={42} className="text-gray-400" />}
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{currentAsset.name}</p><p className="text-xs text-gray-500">{currentAsset.mimeType}</p></div>
                            <CheckCircle size={20} className="text-green-500 shrink-0" />
                        </div>
                        <div className="space-y-3">
                            <input type="text" required placeholder="Nome do Documento *" value={docName} onChange={e => setDocName(e.target.value)} disabled={isUploading} className={`${inputCls} ${isUploading ? 'opacity-50' : ''}`} />
                            <textarea placeholder="Descrição (opcional)" rows={2} value={docDescription} onChange={e => setDocDescription(e.target.value)} disabled={isUploading} className={`${inputCls} resize-y ${isUploading ? 'opacity-50' : ''}`} />
                        </div>
                        {uploadError && <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{uploadError}</div>}
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={handleCancel} disabled={isUploading} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancelar</button>
                            <button onClick={handleConfirmUpload} disabled={isUploading || !docName.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{isUploading && <Loader2 size={16} className="animate-spin" />}{isUploading ? 'Enviando...' : 'Salvar Anexo'}</button>
                        </div>
                    </div>
                )}
            </div>

            {anexos.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Anexos Adicionados:</h3>
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {anexos.map((a, i) => (
                            <li key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-800 truncate">{a.nome_documento}</p>{a.descricao && <p className="text-xs text-gray-500 truncate">{a.descricao}</p>}</div>
                                <div className="flex items-center gap-1 ml-3 shrink-0">
                                    <a href={a.url_arquivo} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><LinkIcon size={16} /></a>
                                    <button onClick={() => removerAnexo(i, a.path_arquivo)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Secao18MUI;
