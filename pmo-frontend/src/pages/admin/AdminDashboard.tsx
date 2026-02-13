import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    Tabs,
    Tab,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { RefreshCcw, DollarSign, Users, Database, AlertCircle, Eye } from 'lucide-react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { supabase } from '../../supabaseClient';
import LogDetailsDialog, { LogData } from '../../components/admin/LogDetailsDialog';

// --- Types ---
interface DashboardStats {
    active_users_24h: number;
    total_cost_current_month: number;
    total_tokens_current_month: number;
    errors_today: number;
}

// --- Components ---

// KPI Card Component
const KpiCard = ({ title, value, icon, color, subvalue }: any) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
        <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                    {title}
                </Typography>
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: `${color}20`, color: color }}>
                    {icon}
                </Box>
            </Box>
            <Typography variant="h4" fontWeight="bold">
                {value}
            </Typography>
            {subvalue && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    {subvalue}
                </Typography>
            )}
        </CardContent>
    </Card>
);

// --- Page ---
const AdminDashboard = () => {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [trainingLogs, setTrainingLogs] = useState<any[]>([]);

    // Modal State
    const [selectedLog, setSelectedLog] = useState<LogData | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Stats (RPC)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats');
            if (rpcError) console.error('Error fetching stats:', rpcError);
            else setStats(rpcData);

            // 2. Fetch Consumption Logs
            const { data: logsData, error: logsError } = await supabase
                .from('logs_consumo')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (logsError) console.error('Error logs:', logsError);
            else setAuditLogs(logsData || []);

            // 3. Fetch Training Logs
            const { data: trainData, error: trainError } = await supabase
                .from('logs_treinamento')
                .select('*')
                .order('criado_em', { ascending: false })
                .limit(50);

            if (trainError) console.error('Error training:', trainError);
            else {
                setTrainingLogs(trainData || []);
            }

        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (log: any) => {
        setSelectedLog(log);
        setModalOpen(true);
    };

    const handleChangeTab = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    // Columns config
    const consumptionColumns: GridColDef[] = [
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Detalhes',
            width: 80,
            renderCell: (params: any) => (
                <IconButton
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenModal(params.row);
                    }}
                    color="primary"
                    size="small"
                >
                    <Eye size={18} />
                </IconButton>
            )
        },
        {
            field: 'created_at',
            headerName: 'Data',
            width: 180,
            renderCell: (params: GridRenderCellParams) => {
                const rawDate = params.value || params.row.created_at || params.row.criado_em;
                if (!rawDate) return <Typography variant="body2">-</Typography>;

                const date = new Date(rawDate);
                return (
                    <Typography variant="body2">
                        {isNaN(date.getTime()) ? '-' : date.toLocaleString()}
                    </Typography>
                );
            }
        },
        { field: 'user_id', headerName: 'User ID', width: 130 },
        { field: 'acao', headerName: 'Ação', width: 150 },
        { field: 'modelo_ia', headerName: 'Modelo', width: 150 },
        { field: 'total_tokens', headerName: 'Tokens', width: 100 },
        {
            field: 'custo_estimado',
            headerName: 'Custo ($)',
            width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Typography color="error" variant="body2" fontWeight="bold">
                    ${Number(params.value).toFixed(4)}
                </Typography>
            )
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={params.value}
                    color={params.value === 'success' ? 'success' : 'error'}
                    size="small"
                />
            )
        }
    ];

    const trainingColumns: GridColDef[] = [
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Detalhes',
            width: 80,
            renderCell: (params: any) => (
                <IconButton
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenModal(params.row);
                    }}
                    color="primary"
                    size="small"
                >
                    <Eye size={18} />
                </IconButton>
            )
        },
        {
            field: 'criado_em',
            headerName: 'Data',
            width: 160,
            renderCell: (params: GridRenderCellParams) => {
                const rawDate = params.value || params.row.created_at || params.row.criado_em;
                if (!rawDate) return <Typography variant="caption">-</Typography>;
                const date = new Date(rawDate);
                return <Typography variant="caption">{isNaN(date.getTime()) ? '-' : date.toLocaleString()}</Typography>;
            }
        },
        {
            field: 'texto_usuario',
            headerName: 'Texto do Usuário',
            width: 350,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip title={params.value || ''}>
                    <Box sx={{
                        maxHeight: 50,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        fontSize: '0.8rem',
                        lineHeight: 1.2
                    }}>
                        {params.value}
                    </Box>
                </Tooltip>
            )
        },
        {
            field: 'json_extraido',
            headerName: 'IA (Resumo)',
            width: 300,
            renderCell: (params: GridRenderCellParams) => {
                const content = params.row.json_corrigido || params.value;
                const isCorrected = !!params.row.json_corrigido;
                return (
                    <Box sx={{ position: 'relative', width: '100%' }}>
                        {isCorrected && (
                            <Chip label="Corrigido" color="success" size="small" sx={{ position: 'absolute', right: 0, top: 0, height: 16, fontSize: '0.6rem' }} />
                        )}
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isCorrected ? 'success.main' : 'text.secondary' }}>
                            {JSON.stringify(content).slice(0, 50)}...
                        </Typography>
                    </Box>
                );
            }
        }
    ];

    const TabPanel = (props: { children?: React.ReactNode; index: number; value: number }) => {
        const { children, value, index, ...other } = props;
        return (
            <div role="tabpanel" hidden={value !== index} {...other}>
                {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
            </div>
        );
    };

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Painel de Controle</Typography>
                <Button
                    variant="contained"
                    startIcon={<RefreshCcw size={18} />}
                    onClick={fetchData}
                    disabled={loading}
                >
                    {loading ? 'Atualizando...' : 'Atualizar'}
                </Button>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={handleChangeTab} indicatorColor="primary" textColor="primary">
                    <Tab label="Visão Geral" />
                    <Tab label="Auditoria Financeira" />
                    <Tab label="Treinamento da LLM" />
                </Tabs>
            </Paper>

            {/* TAB 1: OVERVIEW (KPIs) */}
            <TabPanel value={tabValue} index={0}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                        <KpiCard
                            title="Usuários Ativos"
                            value={stats?.active_users_24h ?? '-'}
                            icon={<Users />}
                            color="#2563eb"
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <KpiCard
                            title="Custo Mês"
                            value={`$${Number(stats?.total_cost_current_month || 0).toFixed(2)}`}
                            icon={<DollarSign />}
                            color="#dc2626"
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <KpiCard
                            title="Tokens Mês"
                            value={stats?.total_tokens_current_month ?? '-'}
                            icon={<Database />}
                            color="#7c3aed"
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <KpiCard
                            title="Erros Hoje"
                            value={stats?.errors_today ?? '-'}
                            icon={<AlertCircle />}
                            color="#ea580c"
                        />
                    </Grid>
                </Grid>
            </TabPanel>

            {/* TAB 2: AUDIT LOGS */}
            <TabPanel value={tabValue} index={1}>
                <Paper sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={auditLogs}
                        columns={consumptionColumns}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 10 } },
                        }}
                        pageSizeOptions={[10, 25, 50]}
                        loading={loading}
                        disableRowSelectionOnClick
                    />
                </Paper>
            </TabPanel>

            {/* TAB 3: TRAINING LOGS */}
            <TabPanel value={tabValue} index={2}>
                <Paper sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={trainingLogs}
                        columns={trainingColumns}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 10 } },
                        }}
                        pageSizeOptions={[10, 25, 50]}
                        loading={loading}
                        disableRowSelectionOnClick
                    />
                </Paper>
            </TabPanel>

            {/* New Unified Modal */}
            <LogDetailsDialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                log={selectedLog}
            />
        </Box>
    );
};

export default AdminDashboard;
