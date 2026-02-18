// src/pages/SignUpPage.tsx (Manejo Org Design System - Dark Glassmorphism)

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../hooks/navigation/useAppNavigation';
import {
    Avatar,
    Box,
    Button,
    Grid,
    Link,
    TextField,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    InputAdornment,
    useTheme,
    SelectChangeEvent,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';

// Shared input styles for dark theme (same as LoginPage)
const inputStyles = {
    '& .MuiOutlinedInput-root': {
        bgcolor: '#0f172a', // Solid Slate 900
        color: 'white',
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        '& fieldset': {
            border: '1px solid rgba(255, 255, 255, 0.08)',
        },
        '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&.Mui-focused': {
            bgcolor: '#0f172a',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'primary.main',
            boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.5)',
        },
        '& input:-webkit-autofill': {
            '-webkit-box-shadow': '0 0 0 100px #0f172a inset !important',
            '-webkit-text-fill-color': '#f1f5f9 !important',
            'caretColor': '#f1f5f9',
            'borderRadius': 'inherit',
        },
    },
    '& .MuiInputBase-input::placeholder': {
        color: 'grey.500',
        opacity: 1,
    },
    '& .MuiInputLabel-root': {
        color: 'grey.400',
    },
    '& .MuiInputLabel-root.Mui-focused': {
        color: 'grey.300',
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
        color: 'grey.500',
    },
} as const;

// Select styles for dark theme
const selectStyles = {
    '& .MuiOutlinedInput-root': {
        bgcolor: '#0f172a', // Solid Slate 900
        color: 'white',
        borderRadius: 1.5,
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'primary.main',
            boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.4)',
        },
    },
    '& .MuiSelect-icon': {
        color: 'grey.500',
    },
    '& .MuiInputLabel-root': {
        color: 'grey.400',
    },
    '& .MuiInputLabel-root.Mui-focused': {
        color: 'grey.300',
    },
} as const;

function SignUpPage() {
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [profession, setProfession] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { goToLogin } = useAppNavigation();
    const theme = useTheme();

    const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const profileData = {
            full_name: fullName,
            profession: profession,
            gender: gender,
            birth_date: birthDate,
        };

        try {
            await signUp(email, password, profileData);
            alert('Cadastro realizado! Um link de confirmação foi enviado para o seu e-mail.');
            goToLogin();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao realizar o cadastro.';
            setError(message);
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                py: { xs: 4, md: 8 },
            }}
        >
            {/* Background Image with Organic Theme */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 0,
                    backgroundImage: `url('https://images.unsplash.com/photo-1625246333195-58197bd47d26?q=80&w=2561&auto=format&fit=crop')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            >
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)' }} />
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(15, 23, 42, 0.9))' }} />
            </Box>

            <Paper
                elevation={0}
                sx={{
                    position: 'relative',
                    zIndex: 10,
                    maxWidth: 550,
                    width: '100%',
                    mx: 2,
                    p: 4,
                    borderRadius: 4,
                    bgcolor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
            >
                {/* Header Section */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        mb: 4,
                    }}
                >
                    <Avatar
                        variant="rounded"
                        sx={{
                            mb: 2,
                            bgcolor: 'primary.main',
                            width: 48,
                            height: 48,
                            fontSize: '1.125rem',
                            fontWeight: 'bold',
                            boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.2)',
                            borderRadius: 2,
                        }}
                    >
                        MO
                    </Avatar>
                    <Typography component="h1" variant="h5" sx={{ fontWeight: 700, color: 'white', letterSpacing: '-0.025em' }}>
                        Cadastre-se
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'grey.300', mt: 0.5 }}>
                        Crie sua conta e comece a gerenciar
                    </Typography>
                </Box>

                {/* Form Section */}
                <Box component="form" onSubmit={handleSignUp} role="form">
                    <Grid container spacing={3}>
                        {/* Full Name */}
                        <Grid item xs={12}>
                            <TextField
                                name="fullName"
                                required
                                fullWidth
                                id="fullName"
                                placeholder="Nome Completo"
                                autoFocus
                                value={fullName}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <PersonOutlineIcon />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={inputStyles}
                            />
                        </Grid>

                        {/* Birth Date */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="birthDate"
                                required
                                fullWidth
                                id="birthDate"
                                placeholder="Data de Nascimento"
                                type="date"
                                value={birthDate}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <CalendarTodayIcon />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={inputStyles}
                            />
                        </Grid>

                        {/* Gender */}
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required sx={selectStyles}>
                                <Select
                                    displayEmpty
                                    id="gender"
                                    value={gender}
                                    onChange={(e: SelectChangeEvent) => setGender(e.target.value)}
                                    sx={{ color: gender ? 'white' : 'grey.500' }}
                                    renderValue={(selected) => {
                                        if (selected.length === 0) {
                                            return <span>Gênero</span>;
                                        }
                                        return selected === 'feminino' ? 'Feminino' : selected === 'masculino' ? 'Masculino' : selected === 'nao_binario' ? 'Não-binário' : selected === 'outro' ? 'Outro' : 'Prefiro não informar';
                                    }}
                                >
                                    <MenuItem disabled value="">
                                        <em>Gênero</em>
                                    </MenuItem>
                                    <MenuItem value="feminino">Feminino</MenuItem>
                                    <MenuItem value="masculino">Masculino</MenuItem>
                                    <MenuItem value="nao_binario">Não-binário</MenuItem>
                                    <MenuItem value="outro">Outro</MenuItem>
                                    <MenuItem value="nao_informar">Prefiro não informar</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Profession */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required sx={selectStyles}>
                                <Select
                                    displayEmpty
                                    id="profession"
                                    value={profession}
                                    onChange={(e: SelectChangeEvent) => setProfession(e.target.value)}
                                    startAdornment={
                                        <InputAdornment position="start">
                                            <WorkOutlineIcon sx={{ color: 'grey.500' }} />
                                        </InputAdornment>
                                    }
                                    sx={{ color: profession ? 'white' : 'grey.500' }}
                                    renderValue={(selected) => {
                                        if (selected.length === 0) {
                                            return <span>Profissão / Área de Atuação</span>;
                                        }
                                        return selected;
                                    }}
                                >
                                    <MenuItem disabled value="">
                                        <em>Profissão / Área de Atuação</em>
                                    </MenuItem>
                                    <MenuItem value="agricultor">Agricultor(a)</MenuItem>
                                    <MenuItem value="agronomo">Engenheiro(a) Agrônomo(a)</MenuItem>
                                    <MenuItem value="tecnico">Técnico(a) Agrícola</MenuItem>
                                    <MenuItem value="estudante">Estudante</MenuItem>
                                    <MenuItem value="consultor">Consultor(a)</MenuItem>
                                    <MenuItem value="outro">Outro</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Email */}
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                id="email"
                                placeholder="Endereço de E-mail"
                                name="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailOutlinedIcon />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={inputStyles}
                            />
                        </Grid>

                        {/* Password */}
                        <Grid item xs={12}>
                            <TextField
                                required
                                fullWidth
                                name="password"
                                placeholder="Senha (mínimo 6 caracteres)"
                                type="password"
                                id="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockOutlinedIcon />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={inputStyles}
                            />
                        </Grid>
                    </Grid>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        size="large"
                        variant="contained"
                        sx={{
                            mt: 3, // mt-2 in login, but here keeping mt-3 for spacing
                            mb: 2,
                            height: 48,
                            textTransform: 'none',
                            fontSize: '1rem',
                            boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.25)',
                        }}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Cadastrar'}
                    </Button>

                    {/* Login Link */}
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="body2" component="span" sx={{ color: 'grey.400' }}>
                            Já tem uma conta?{' '}
                        </Typography>
                        <Link
                            component="button"
                            variant="body2"
                            underline="hover"
                            onClick={goToLogin}
                            sx={{ color: 'primary.main' }}
                        >
                            Faça o login
                        </Link>
                    </Box>
                </Box>
            </Paper>

            {/* Footer */}
            <Box component="footer" sx={{ position: 'relative', zIndex: 10, mt: 4, mb: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.625rem' }}>
                    {import.meta.env.VITE_APP_NAME} © {new Date().getFullYear()}
                </Typography>
            </Box>
        </Box>
    );
}

export default SignUpPage;
