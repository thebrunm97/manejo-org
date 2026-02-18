import { createTheme, alpha } from '@mui/material/styles';

// --- Design System Tokens ---

// Palette: Cold Neutrals (Slate) + Manejo Org Green
const palette = {
  primary: {
    main: '#15803d', // Green-700
    light: '#4ade80', // Green-400
    dark: '#14532d', // Green-900
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#64748b', // Slate-500 (Neutral)
    light: '#94a3b8', // Slate-400
    dark: '#334155', // Slate-700
    contrastText: '#ffffff',
  },
  success: {
    main: '#16a34a', // Green-600 (Previously secondary)
    light: '#86efac',
    dark: '#15803d',
    contrastText: '#ffffff',
  },
  background: {
    default: '#f8fafc', // Slate-50
    paper: '#ffffff',
    subtle: '#f1f5f9', // Slate-100 (for sidebars, hovers)
  },
  text: {
    primary: '#0f172a', // Slate-900
    secondary: '#64748b', // Slate-500
    disabled: '#cbd5e1', // Slate-300
  },
  divider: '#e2e8f0', // Slate-200
  // Custom tokens for Dashboard Manejo Org design system
  custom: {
    cardDark: '#020617',
    accentSoft: '#DCFCE7',
    bgCanvas: '#F8FAFC',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F1F5F9',
    borderSubtle: '#E2E8F0',
    fgPrimary: '#0F172A',
    fgSecondary: '#334155',
    fgMuted: '#64748B',
  },
  action: {
    hover: alpha('#0f172a', 0.04),
    selected: alpha('#15803d', 0.08),
    disabled: alpha('#0f172a', 0.26),
    disabledBackground: alpha('#0f172a', 0.12),
  },
};

// Radius Scale
const shape = {
  borderRadius: 6, // default (sm)
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    pill: 9999,
  },
};

// Typography: Inter
const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  htmlFontSize: 16,
  h1: {
    fontWeight: 700,
    fontSize: '2rem', // 32px
    lineHeight: 1.2,
    color: palette.text.primary,
  },
  h2: {
    fontWeight: 700,
    fontSize: '1.5rem', // 24px
    lineHeight: 1.3,
    color: palette.text.primary,
  },
  h3: {
    fontWeight: 600,
    fontSize: '1.25rem', // 20px
    lineHeight: 1.4,
    color: palette.text.primary,
  },
  h4: {
    fontWeight: 600,
    fontSize: '1.125rem', // 18px
    lineHeight: 1.4,
  },
  h5: {
    fontWeight: 600,
    fontSize: '1rem', // 16px
    lineHeight: 1.5,
  },
  h6: {
    fontWeight: 600,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.57,
  },
  body1: {
    fontSize: '1rem', // 16px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem', // 14px
    fontWeight: 400,
    lineHeight: 1.57,
    color: palette.text.secondary,
  },
  button: {
    textTransform: 'none',
    fontWeight: 600,
  },
};

const theme = createTheme({
  palette,
  shape,
  typography,
  spacing: 4, // 4px grid system
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#94a3b8 #f1f5f9',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#f1f5f9',
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: '8px',
            backgroundColor: '#94a3b8',
            minHeight: '24px',
            border: '2px solid #f1f5f9',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#64748b',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
      },
      styleOverrides: {
        root: {
          borderRadius: shape.radius.sm, // 6px
          padding: '8px 16px',
        },
        sizeSmall: {
          padding: '4px 10px',
        },
        sizeLarge: {
          padding: '10px 22px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: shape.radius.md, // 8px
          border: `1px solid ${palette.divider}`,
          backgroundImage: 'none',
          boxShadow: 'none', // Flat design
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          border: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${palette.divider}`,
          backgroundColor: palette.background.paper,
          color: palette.text.primary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.default, // or palette.text.primary for dark sidebar
          borderRight: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: shape.radius.sm, // 6px
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: shape.radius.sm, // 6px
        },
      },
    },
  },
});

export default theme;