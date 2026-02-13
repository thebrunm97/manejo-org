import React from 'react';
import { Box, Typography, Paper, Chip, Divider, Accordion, AccordionSummary, AccordionDetails, AppBar, Toolbar, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changelogData } from '../data/changelog';
import { ChevronDown, Tag, Calendar, CheckCircle, AlertCircle, Zap, Star, ArrowLeft } from 'lucide-react';

const ChangelogPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleBack = () => {
        navigate(user ? '/dashboard' : '/');
    };

    // Helper para ícones por tipo
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Improvements': return <Zap size={16} color="#eab308" />;
            case 'Fixes': return <CheckCircle size={16} color="#22c55e" />;
            case 'Patches': return <AlertCircle size={16} color="#ef4444" />;
            case 'New': return <Star size={16} color="#3b82f6" />;
            default: return <Tag size={16} />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Improvements': return '#fef9c3';
            case 'Fixes': return '#dcfce7';
            case 'Patches': return '#fee2e2';
            case 'New': return '#dbeafe';
            default: return '#f3f4f6';
        }
    };

    return (
        <Box>
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #e2e8f0' }}>
                <Toolbar>
                    <IconButton edge="start" onClick={handleBack} sx={{ mr: 2, color: '#334155' }}>
                        <ArrowLeft size={22} />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a' }}>
                        Novidades
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box sx={{ maxWidth: 1000, mx: 'auto', p: 4 }}>
                <Box sx={{ mb: 6, textAlign: 'center' }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                        Novidades e Atualizações
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1.1rem' }}>
                        Acompanhe a evolução do Manejo Orgânico.
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {changelogData.map((entry, index) => (
                        <Box key={index} sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
                            {/* Left: Version Info */}
                            <Box sx={{ width: { xs: '100%', md: '200px' }, flexShrink: 0, pt: 2 }}>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                    {entry.version}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, color: '#64748b' }}>
                                    <Calendar size={14} />
                                    <Typography variant="caption" sx={{ fontSize: '0.85rem' }}>
                                        {entry.date}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Right: Content Card */}
                            <Paper sx={{
                                flex: 1,
                                borderRadius: '24px',
                                border: '1px solid #e2e8f0',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                            }}>
                                <Box sx={{ p: 4, bgcolor: '#ffffff' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
                                        {entry.title}
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.6 }}>
                                        {entry.description}
                                    </Typography>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {entry.sections.map((section, sIndex) => (
                                            <Box key={sIndex}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.5,
                                                    mb: 2,
                                                    pb: 1,
                                                    borderBottom: '1px solid #f1f5f9'
                                                }}>
                                                    <Box sx={{
                                                        p: 0.8,
                                                        borderRadius: '8px',
                                                        bgcolor: getTypeColor(section.type),
                                                        display: 'flex'
                                                    }}>
                                                        {getTypeIcon(section.type)}
                                                    </Box>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                                                        {section.type === 'Improvements' ? 'Melhorias' :
                                                            section.type === 'Fixes' ? 'Correções' :
                                                                section.type === 'Patches' ? 'Ajustes' : 'Novidades'}
                                                    </Typography>
                                                    <Chip
                                                        label={section.items.length}
                                                        size="small"
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            bgcolor: getTypeColor(section.type),
                                                            color: '#334155'
                                                        }}
                                                    />
                                                </Box>
                                                <Box component="ul" sx={{ m: 0, pl: 2, listStyle: 'none' }}>
                                                    {section.items.map((item, iIndex) => (
                                                        <Box component="li" key={iIndex} sx={{
                                                            mb: 1.5,
                                                            position: 'relative',
                                                            '&::before': {
                                                                content: '""',
                                                                position: 'absolute',
                                                                left: -16,
                                                                top: 8,
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                bgcolor: '#cbd5e1'
                                                            }
                                                        }}>
                                                            <Typography variant="body2" sx={{ color: '#475569' }}>
                                                                {item}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default ChangelogPage;
