import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, Stack,
    Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import { TableColumn } from './TabelaDinamica_MUI';

interface Props {
    open: boolean;
    initialData: any;
    columns: TableColumn[];
    onClose: () => void;
    onConfirm: (data: any) => void;
}

/**
 * Dialog to review and edit AI suggestions before adding to the table.
 * Dynamically renders fields based on table columns.
 */
export default function SuggestionReviewDialog({
    open,
    initialData,
    columns,
    onClose,
    onConfirm
}: Props) {
    const [formData, setFormData] = useState<any>({});

    // Reset form when opening
    useEffect(() => {
        if (open && initialData) {
            setFormData({ ...initialData });
        }
    }, [open, initialData]);

    const handleChange = (id: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [id]: value }));
    };

    const handleSave = () => {
        onConfirm(formData);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', pb: 2 }}>
                Revisar Sugestão do Assistente
            </DialogTitle>

            <DialogContent dividers sx={{ pt: 3 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Verifique os dados extraídos abaixo e complemente o que for necessário antes de adicionar à tabela.
                </Typography>

                <Stack spacing={2}>
                    {columns.map((col) => {
                        // Skip actions column
                        if (col.id === 'actions') return null;

                        // Unit Selector Handling
                        if (col.unitSelector) {
                            return (
                                <Stack direction="row" spacing={1} key={col.id} alignItems="flex-start">
                                    <TextField
                                        label={col.label}
                                        type={col.type === 'number' ? 'number' : 'text'}
                                        value={formData[col.id] || ''}
                                        onChange={(e) => handleChange(col.id, e.target.value)}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        placeholder={col.placeholder || "Valor"}
                                        sx={{ flex: 1 }}
                                    />
                                    <FormControl size="small" sx={{ minWidth: 120 }}>
                                        <InputLabel>Unidade</InputLabel>
                                        <Select
                                            value={formData[col.unitSelector.key] || ''}
                                            label="Unidade"
                                            onChange={(e) => handleChange(col.unitSelector.key, e.target.value)}
                                        >
                                            {col.unitSelector.options.map((opt) => (
                                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            );
                        }

                        // Standard Field
                        return (
                            <TextField
                                key={col.id}
                                label={col.label}
                                value={formData[col.id] || ''}
                                onChange={(e) => handleChange(col.id, e.target.value)}
                                fullWidth
                                variant="outlined"
                                size="small"
                                placeholder={col.placeholder}
                                helperText={col.suffix ? `Unidade esperada: ${col.suffix}` : undefined}
                            />
                        );
                    })}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">
                    Cancelar
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    sx={{ px: 4 }}
                >
                    Adicionar à Tabela
                </Button>
            </DialogActions>
        </Dialog>
    );
}
