// src/components/PmoForm/Secao18_MUI.tsx

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useMediaManager } from '../../hooks/media/useMediaManager';
import {
    Box, Button, TextField, Typography, List, ListItem, ListItemText,
    IconButton, CircularProgress, Alert, Link, Paper, Stack, Card, CardContent, CardMedia
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Types
interface Anexo {
    nome_documento: string;
    descricao?: string;
    url_arquivo: string;
    path_arquivo: string;
}

interface Secao18Data {
    lista_anexos?: Anexo[];
    [key: string]: any;
}

interface Secao18MUIProps {
    data: Secao18Data | null | undefined;
    onSectionChange: (data: Secao18Data) => void;
}

const Secao18MUI: React.FC<Secao18MUIProps> = ({ data, onSectionChange }) => {
    const safeData = data || {};
    const anexos: Anexo[] = Array.isArray(safeData.lista_anexos) ? safeData.lista_anexos : [];

    // Auth
    const { user } = useAuth();

    // Hook de Mídia (Abstração)
    const {
        currentAsset,
        isUploading,
        uploadError,
        selectImage,
        selectDocument,
        uploadAsset,
        clearAsset
    } = useMediaManager();

    // Campos locais do formulário de anexo
    const [docName, setDocName] = useState('');
    const [docDescription, setDocDescription] = useState('');

    // Preenche automaticamente o nome se o asset mudar e nome estiver vazio
    React.useEffect(() => {
        if (currentAsset && !docName) {
            const nameParts = currentAsset.name.split('.');
            if (nameParts.length > 1) nameParts.pop(); // Remove extensão
            setDocName(nameParts.join('.'));
        }
    }, [currentAsset]);

    const handleConfirmUpload = async () => {
        if (!currentAsset) return;
        if (!docName.trim()) {
            alert('O nome do documento é obrigatório.');
            return;
        }
        if (!user) {
            alert('Usuário não autenticado.');
            return;
        }

        const publicUrl = await uploadAsset(user.id);

        if (publicUrl) {
            // Sucesso! Adicionar à lista
            const fileExt = currentAsset.name.split('.').pop();
            const fileNameOnStorage = publicUrl.split('/').pop() || `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileNameOnStorage}`; // Caminho reconstruído (Supabase bucket logic)

            const novoAnexo: Anexo = {
                nome_documento: docName,
                descricao: docDescription,
                url_arquivo: publicUrl,
                path_arquivo: filePath, // Nota: caminho relativo pode precisar de ajuste se storageBucketService mudar
            };

            onSectionChange({ ...safeData, lista_anexos: [...anexos, novoAnexo] });
            handleCancel();
        }
    };

    const handleCancel = () => {
        clearAsset();
        setDocName('');
        setDocDescription('');
    };

    const removerAnexoDaLista = async (index: number, path_arquivo: string) => {
        try {
            // TODO: Mover remoção para o storageBucketService também para manter consistência
            const { error: deleteError } = await supabase.storage.from('anexos-pmos').remove([path_arquivo]);
            if (deleteError) throw deleteError;

            const novosAnexos = anexos.filter((_, i) => i !== index);
            onSectionChange({ ...safeData, lista_anexos: novosAnexos });
        } catch (err: any) {
            console.error('Erro ao remover anexo:', err);
            alert('Falha ao remover o anexo: ' + err.message);
        }
    };

    return (
        <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Seção 18: Anexos</Typography>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h6" gutterBottom>Adicionar Novo Documento</Typography>

                {/* Seleção ou Preview */}
                {!currentAsset ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, mt: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<PhotoCameraIcon />}
                            onClick={() => selectImage('camera')}
                            fullWidth
                            sx={{ py: 3, borderRadius: 2, borderStyle: 'dashed', borderWidth: 2 }}
                        >
                            Adicionar Foto
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<AttachFileIcon />}
                            onClick={selectDocument}
                            fullWidth
                            sx={{ py: 3, borderRadius: 2, borderStyle: 'dashed', borderWidth: 2 }}
                        >
                            Anexar Documento
                        </Button>
                    </Stack>
                ) : (
                    <Card variant="outlined" sx={{ mb: 3, mt: 2, bgcolor: '#f8fafc' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                {currentAsset.type === 'image' ? (
                                    <Box
                                        component="img"
                                        src={currentAsset.uri}
                                        sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover' }}
                                    />
                                ) : (
                                    <DescriptionIcon sx={{ fontSize: 50, color: 'text.secondary' }} />
                                )}
                                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                    <Typography variant="subtitle2" noWrap>{currentAsset.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">{currentAsset.mimeType}</Typography>
                                </Box>
                                <CheckCircleIcon color="success" />
                            </Box>

                            <TextField
                                required
                                label="Nome do Documento"
                                placeholder="Ex: Foto do Talhão 1"
                                fullWidth
                                value={docName}
                                onChange={(e) => setDocName(e.target.value)}
                                sx={{ mb: 2 }}
                                disabled={isUploading}
                            />
                            <TextField
                                label="Descrição (opcional)"
                                placeholder="Detalhes adicionais..."
                                fullWidth
                                multiline
                                rows={2}
                                value={docDescription}
                                onChange={(e) => setDocDescription(e.target.value)}
                                disabled={isUploading}
                            />

                            {uploadError && <Alert severity="error" sx={{ mt: 2 }}>{uploadError}</Alert>}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={handleCancel}
                                    disabled={isUploading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleConfirmUpload}
                                    disabled={isUploading || !docName.trim()}
                                    startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
                                >
                                    {isUploading ? 'Enviando...' : 'Salvar Anexo'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Paper>

            {/* Lista de Anexos Existentes */}
            {anexos.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom>Anexos Adicionados:</Typography>
                    <List>
                        {anexos.map((anexo, index) => (
                            <ListItem key={index} divider secondaryAction={
                                <>
                                    <IconButton edge="end" aria-label="ver" component={Link} href={anexo.url_arquivo} target="_blank" rel="noopener noreferrer"><LinkIcon /></IconButton>
                                    <IconButton edge="end" aria-label="deletar" onClick={() => removerAnexoDaLista(index, anexo.path_arquivo)} color="error" sx={{ ml: 1 }}><DeleteIcon /></IconButton>
                                </>
                            }>
                                <ListItemText primary={anexo.nome_documento} secondary={anexo.descricao || ''} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}
        </Box>
    );
};

export default Secao18MUI;
