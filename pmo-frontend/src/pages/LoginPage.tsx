// src/pages/LoginPage.tsx (Versão TSX - AgroVivo Design System)

import React, { useState, FormEvent } from 'react';
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
    Divider,
    CircularProgress,
    Alert,
    IconButton,
    Paper,
    InputAdornment,
    FormControlLabel,
    Checkbox,
    useTheme,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import ScienceIcon from '@mui/icons-material/Science';

// Shared input styles for dark theme (bg-slate-950/50 approx)
const inputStyles = {
    '& .MuiOutlinedInput-root': {
        bgcolor: '#0f172a', // Solid Slate 900
        color: 'white',
        borderRadius: 2, // Slightly more rounded (8px)
        transition: 'all 0.2s ease-in-out',
        '& fieldset': {
            border: '1px solid rgba(255, 255, 255, 0.08)', // Very subtle border, no notch
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

// Social button styles (bg-white/5, hover:bg-white/10)
const socialButtonStyles = {
    borderColor: 'transparent',
    color: 'white',
    bgcolor: 'rgba(255, 255, 255, 0.05)',
    textTransform: 'none',
    borderWidth: 0,
    height: 44,
    fontSize: '0.9rem',
    '&:hover': {
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'transparent',
    },
} as const;

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle, loginWithFacebook } = useAuth();
    const { goHome, goToSignUp, goToLab } = useAppNavigation();
    const theme = useTheme();

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            goHome();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao fazer login. Verifique suas credenciais.';
            setError(message);
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        try {
            setError('');
            if (provider === 'google') await loginWithGoogle();
            if (provider === 'facebook') await loginWithFacebook();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : `Falha ao fazer login com ${provider}.`;
            setError(message);
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
                overflow: 'hidden', // Hide scrollbars for the absolute background
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
                {/* Dark overlay for contrast */}
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)' }} />
                {/* Organic decorative gradients */}
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(15, 23, 42, 0.9))' }} />
            </Box>

            <Paper
                elevation={0}
                sx={{
                    position: 'relative', // Ensure z-index works
                    zIndex: 10,
                    maxWidth: 420, // Match max-w-[420px]
                    width: '100%',
                    mx: 2,
                    p: 4, // p-8 approx 32px -> 4 * 8 = 32px.
                    borderRadius: 4, // rounded-2xl
                    bgcolor: 'rgba(15, 23, 42, 0.4)', // bg-slate-900/40
                    backdropFilter: 'blur(24px)', // backdrop-blur-xl
                    border: '1px solid rgba(255, 255, 255, 0.1)', // border-white/10
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', // shadow-2xl
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
                            width: 48, // w-12
                            height: 48, // h-12
                            fontSize: '1.125rem', // text-lg
                            fontWeight: 'bold',
                            boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.2)', // shadow-lg shadow-accent/20
                            borderRadius: 2, // rounded-lg
                        }}
                    >
                        AV
                    </Avatar>
                    <Typography component="h1" variant="h5" sx={{ fontWeight: 700, color: 'white', letterSpacing: '-0.025em' }}>
                        Bem-vindo de volta
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'grey.300', mt: 0.5 }}>
                        Acesse sua gestão agrícola inteligente
                    </Typography>
                </Box>

                {/* Form Section */}
                <Box component="form" onSubmit={handleLogin} role="form">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        placeholder="Endereço de E-mail"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <EmailOutlinedIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={inputStyles}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        placeholder="Sua Senha"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockOutlinedIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={inputStyles}
                    />

                    {/* Options Row */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mt: 1,
                            mb: 2,
                        }}
                    >
                        <FormControlLabel
                            control={<Checkbox value="remember" size="small" sx={{ color: 'grey.500', '&.Mui-checked': { color: 'primary.main' } }} />}
                            label={<Typography variant="body2" sx={{ color: 'grey.400' }}>Lembrar-me</Typography>}
                        />
                        <Link href="#" variant="body2" underline="hover" sx={{ color: 'primary.light' }}>
                            Esqueceu a senha?
                        </Link>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        size="large"
                        variant="contained"
                        sx={{
                            mt: 2,
                            mb: 2,
                            height: 48,
                            textTransform: 'none',
                            fontSize: '1rem',
                            boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.25)',
                        }}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
                    </Button>

                    <Divider sx={{ my: 3, borderColor: 'rgba(148,163,184,0.25)' }}>
                        <Typography variant="caption" sx={{ color: 'grey.500', letterSpacing: 1, fontWeight: 500, textTransform: 'uppercase' }}>
                            OU CONTINUE COM
                        </Typography>
                    </Divider>

                    {/* Social Login Buttons */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<GoogleIcon />}
                                onClick={() => handleSocialLogin('google')}
                                sx={socialButtonStyles}
                            >
                                Google
                            </Button>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<FacebookIcon />}
                                onClick={() => handleSocialLogin('facebook')}
                                sx={socialButtonStyles}
                            >
                                Facebook
                            </Button>
                        </Grid>
                    </Grid>

                    {/* Registration Link */}
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2" component="span" sx={{ color: 'grey.400' }}>
                            Não tem uma conta?{' '}
                        </Typography>
                        <Link
                            component="button"
                            variant="body2"
                            underline="hover"
                            onClick={goToSignUp}
                            sx={{ color: 'primary.main' }}
                        >
                            Cadastre-se
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

            {/* Lab Button (Secret Access) */}
            <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 10 }}>
                <IconButton
                    onClick={goToLab}
                    title="Ir para Lab de Design"
                    sx={{
                        color: 'rgba(255,255,255,0.1)',
                        '&:hover': { color: '#4ade80', bgcolor: 'rgba(255, 255, 255, 0.05)' },
                    }}
                >
                    <ScienceIcon />
                </IconButton>
            </Box>
        </Box>
    );
}

export default LoginPage;