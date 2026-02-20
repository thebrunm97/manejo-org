// src/hooks/useIsMobile.ts
// Replaces MUI's useMediaQuery(theme.breakpoints.down('sm')).
// 640px matches Tailwind's 'sm' breakpoint.

import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 640): boolean {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

        setIsMobile(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [breakpoint]);

    return isMobile;
}
