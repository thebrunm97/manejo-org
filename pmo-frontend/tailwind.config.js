/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    corePlugins: {
        preflight: false, // Disable preflight to avoid conflicts with MUI
    },
    theme: {
        extend: {
            colors: {
                primary: {
                    main: '#15803d', // Green-700
                    light: '#4ade80', // Green-400
                    dark: '#14532d', // Green-900
                    contrastText: '#ffffff',
                    ...{ // Legacy aliases for safety
                        DEFAULT: '#15803d',
                        50: '#f0fdf4',
                        100: '#dcfce7',
                        200: '#bbf7d0',
                        300: '#86efac',
                        400: '#4ade80',
                        500: '#22c55e',
                        600: '#16a34a',
                        700: '#15803d',
                        800: '#166534',
                        900: '#14532d',
                        950: '#052e16',
                    }
                },
                secondary: {
                    main: '#64748b', // Slate-500
                    light: '#94a3b8', // Slate-400
                    dark: '#334155', // Slate-700
                    contrastText: '#ffffff',
                },
                success: {
                    main: '#16a34a', // Green-600
                    light: '#86efac',
                    dark: '#15803d',
                    contrastText: '#ffffff',
                },
                background: {
                    default: '#f8fafc', // Slate-50
                    paper: '#ffffff',
                    subtle: '#f1f5f9', // Slate-100
                },
                text: {
                    primary: '#0f172a', // Slate-900
                    secondary: '#64748b', // Slate-500
                    disabled: '#cbd5e1', // Slate-300
                },
                divider: '#e2e8f0', // Slate-200
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
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
            },
            borderRadius: {
                xs: '4px',
                sm: '6px',
                md: '8px',
                lg: '12px',
                pill: '9999px',
            },
        },
    },
    plugins: [],
}
