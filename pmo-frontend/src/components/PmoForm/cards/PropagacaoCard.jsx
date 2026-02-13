import React from 'react';
import {
    Card, CardContent, CardActions, Typography, Chip, Box, IconButton, Stack, Tooltip
} from '@mui/material';
import { Edit, Trash2, Sprout, Calendar } from 'lucide-react';

const PropagacaoCard = ({ item, onEdit, onDelete }) => {
    const isOrganic = item.sistema_organico === true;

    return (
        <Card
            elevation={2}
            sx={{
                borderRadius: 2,
                borderLeft: '4px solid #16a34a',
                transition: 'all 0.2s',
                '&:hover': { elevation: 4, transform: 'translateY(-2px)' }
            }}
        >
            <CardContent>
                {/* Header com Tipo */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Chip
                        label={item.tipo === 'semente' ? 'Semente' : 'Muda'}
                        size="small"
                        sx={{
                            bgcolor: '#16a34a',
                            color: 'white',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '0.7rem'
                        }}
                    />
                    <Box>
                        <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => onEdit(item)} sx={{ color: '#16a34a' }}>
                                <Edit size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                            <IconButton size="small" onClick={() => onDelete(item)} sx={{ color: '#ef4444' }}>
                                <Trash2 size={18} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Título Principal */}
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sprout size={20} color="#16a34a" />
                    {item.especies || 'Não especificado'}
                </Typography>

                {/* Chips de Informação */}
                <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Chip
                        label={`Origem: ${item.origem || 'N/A'}`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                    />
                    {item.sistema_organico !== null && (
                        <Chip
                            label={isOrganic ? 'Orgânico' : 'Convencional'}
                            size="small"
                            sx={{
                                bgcolor: isOrganic ? '#dcfce7' : '#f3f4f6',
                                color: isOrganic ? '#166534' : '#6b7280',
                                fontWeight: 600
                            }}
                        />
                    )}
                </Stack>

                {/* Metadados */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {item.quantidade && (
                        <Typography variant="body2" color="text.secondary">
                            <strong>Quantidade:</strong> {item.quantidade}
                        </Typography>
                    )}
                    {item.data_compra && (
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Calendar size={14} />
                            <strong>Compra:</strong> {new Date(item.data_compra).toLocaleDateString('pt-BR')}
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default PropagacaoCard;
