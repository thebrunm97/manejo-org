import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    Grid,
    Stack,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'; // Vegetal
import PetsIcon from '@mui/icons-material/Pets';                  // Animal
import FactoryIcon from '@mui/icons-material/Factory';           // Agroindústria
import { VegetalItem, AnimalItem, AgroindItem } from './Secao2_MUI';

export type Secao2ItemType = 'VEGETAL' | 'ANIMAL' | 'AGROIND_VEG' | 'AGROIND_ANI';

export interface Secao2RecordDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    item: VegetalItem | AnimalItem | AgroindItem | null;
    type: Secao2ItemType;
}

const getIconByType = (type: Secao2ItemType) => {
    switch (type) {
        case 'VEGETAL':
            return <LocalFloristIcon />;
        case 'ANIMAL':
            return <PetsIcon />;
        case 'AGROIND_VEG':
        case 'AGROIND_ANI':
            return <FactoryIcon />;
        default:
            return <LocalFloristIcon />;
    }
};

const getChipLabel = (type: Secao2ItemType) => {
    switch (type) {
        case 'VEGETAL':
            return 'PPV – Produção Vegetal';
        case 'ANIMAL':
            return 'PPA – Produção Animal';
        case 'AGROIND_VEG':
            return 'PPOV – Agroind. Vegetal';
        case 'AGROIND_ANI':
            return 'PPOA – Agroind. Animal';
        default:
            return 'Atividade';
    }
};

const Secao2RecordDetailsDialog: React.FC<Secao2RecordDetailsDialogProps> = ({
    open,
    onClose,
    item,
    type,
}) => {
    if (!item) return null;

    // Título principal e Type Assertion Helpers
    const getTitle = () => {
        if (type === 'VEGETAL' || type === 'AGROIND_VEG') {
            return (item as VegetalItem | AgroindItem).produto || 'Sem nome';
        }
        if (type === 'ANIMAL' || type === 'AGROIND_ANI') { // AGROIND_ANI also uses 'produto' in AgroindItem definition from Secao2_MUI research, but let's check. 
            // Re-checking research: AgroindItem has 'produto', AnimalItem has 'especie'.
            // Wait, 'AGROIND_ANI' uses AgroindItem which has 'produto'. 'ANIMAL' uses AnimalItem which has 'especie'.
            if (type === 'AGROIND_ANI') return (item as AgroindItem).produto || 'Sem nome';
            return (item as AnimalItem).especie || 'Sem espécie';
        }
        return 'Atividade';
    };

    // Safe Casting
    const isVegetal = type === 'VEGETAL';
    const isAnimal = type === 'ANIMAL';
    const isAgroind = type.startsWith('AGROIND');

    const vegItem = isVegetal ? (item as VegetalItem) : null;
    const animItem = isAnimal ? (item as AnimalItem) : null;
    const agroItem = isAgroind ? (item as AgroindItem) : null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                },
            }}
        >
            {/* HEADER */}
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: 1,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            bgcolor: '#f1f5f9',
                            p: 1,
                            borderRadius: '12px',
                            color: '#0f172a',
                            display: 'flex',
                        }}
                    >
                        {getIconByType(type)}
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                            {getTitle()}
                        </Typography>
                        <Chip
                            label={getChipLabel(type)}
                            size="small"
                            sx={{ mt: 0.5, fontWeight: 600 }}
                            color="success"
                            variant="outlined"
                        />
                    </Box>
                </Box>

                <IconButton
                    size="small"
                    onClick={onClose}
                    sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#e2e8f0' } }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* BODY */}
            <DialogContent dividers sx={{ borderColor: '#f1f5f9' }}>
                <Stack spacing={3}>

                    {/* SEÇÃO 1: INFORMAÇÕES PRINCIPAIS */}
                    <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
                            Informações principais
                        </Typography>
                        <Grid container spacing={2}>
                            {isVegetal && vegItem && (
                                <>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Área Plantada</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {vegItem.area_plantada || '-'} {vegItem.area_plantada_unidade}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Produção Esperada/Ano</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {vegItem.producao_esperada_ano || '-'} {vegItem.producao_unidade}
                                        </Typography>
                                    </Grid>
                                </>
                            )}

                            {isAnimal && animItem && (
                                <>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Nº de Animais</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {animItem.n_de_animais || '-'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Produção Esperada</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {animItem.producao_esperada_ano || '-'} {animItem.producao_unidade}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Peso Vivo Médio</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {animItem.media_de_peso_vivo || '-'} kg
                                        </Typography>
                                    </Grid>
                                </>
                            )}

                            {isAgroind && agroItem && (
                                <>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Frequência</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {agroItem.frequencia_producao || '-'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Época</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {agroItem.epoca_producao || '-'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="caption" color="text.secondary">Produção Esperada</Typography>
                                        <Typography variant="body1" fontWeight={600}>
                                            {agroItem.producao_esperada_ano || '-'} {agroItem.producao_unidade}
                                        </Typography>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </Box>

                    {/* SEÇÃO 2: LOCALIZAÇÃO */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
                            Localização / Áreas
                        </Typography>
                        <Grid container spacing={2}>
                            {isVegetal && vegItem && (
                                <Grid item xs={12}>
                                    <Typography variant="caption" color="text.secondary">Talhões / Canteiros</Typography>
                                    <Typography variant="body1">
                                        {typeof vegItem.talhoes_canteiros === 'string'
                                            ? vegItem.talhoes_canteiros
                                            : (vegItem.talhoes_canteiros as { _display?: string; talhao_nome?: string })?._display
                                            || (vegItem.talhoes_canteiros as { talhao_nome?: string })?.talhao_nome
                                            || 'Não especificado'}
                                    </Typography>
                                </Grid>
                            )}
                            {isAnimal && animItem && (
                                <>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Área Externa (ha)</Typography>
                                        <Typography variant="body1">
                                            {animItem.area_externa || '-'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Área Instalações (m²)</Typography>
                                        <Typography variant="body1">
                                            {animItem.area_interna_instalacoes || '-'}
                                        </Typography>
                                    </Grid>
                                </>
                            )}
                            {isAgroind && (
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="text.secondary">
                                        Localização vinculada à estrutura de processamento da propriedade.
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>
                    </Box>

                    {/* SEÇÃO 3: DETALHES ADICIONAIS */}
                    {(isAnimal || isAgroind) && (
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
                                Detalhes adicionais
                            </Typography>
                            <Grid container spacing={2}>
                                {isAnimal && animItem && (
                                    <>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="text.secondary">Exploração</Typography>
                                            <Typography variant="body1">{animItem.exploracao || '-'}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="text.secondary">Estágio de Vida</Typography>
                                            <Typography variant="body1">{animItem.estagio_de_vida || '-'}</Typography>
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        </Box>
                    )}

                </Stack>
            </DialogContent>

            {/* FOOTER */}
            <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                <Button
                    onClick={onClose}
                    variant="contained"
                    disableElevation
                    sx={{
                        bgcolor: '#0f172a',
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: '10px',
                        px: 3,
                        '&:hover': { bgcolor: '#1e293b' },
                    }}
                >
                    Fechar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default Secao2RecordDetailsDialog;
