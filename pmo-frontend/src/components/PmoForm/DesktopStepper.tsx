// src/components/PmoForm/DesktopStepper.tsx
// Refatorado — Zero MUI. Usa Tailwind + StepIcon nativo.

import React, { useRef, useEffect, useState } from 'react';
import StepIconMUI from './StepIcon';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Types
interface FormSection {
    id: number;
    key: string;
    label: string;
    Component: React.ComponentType<any>;
    validate: (data: any) => boolean;
}

type SectionStatus = 'completo' | 'em-progresso' | 'pendente' | undefined;

interface DesktopStepperMUIProps {
    sections: FormSection[];
    currentStep: number;
    goToStep: (step: number) => void;
    sectionStatus: Record<string, SectionStatus>;
}

const DesktopStepperMUI: React.FC<DesktopStepperMUIProps> = ({
    sections,
    currentStep,
    goToStep,
    sectionStatus
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (el) el.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [sections]);

    const scroll = (dir: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    return (
        <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-1 relative">
            {/* Scroll Left Button */}
            {canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-gray-100 rounded-full p-1 shadow-md border border-gray-200"
                >
                    <ChevronLeft size={18} className="text-green-600" />
                </button>
            )}

            {/* Scrollable Tabs */}
            <div
                ref={scrollRef}
                className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
                {sections.map((section) => {
                    const isActive = currentStep === section.id;
                    const isComplete = sectionStatus[section.key] === 'completo';

                    return (
                        <button
                            key={section.id}
                            onClick={() => goToStep(section.id)}
                            className={`flex flex-col items-center gap-1.5 min-w-[120px] px-3 py-2 shrink-0 rounded-lg transition-colors ${isActive
                                    ? 'bg-green-50'
                                    : 'hover:bg-gray-50'
                                }`}
                        >
                            <StepIconMUI
                                completed={isComplete}
                                active={isActive}
                                icon={section.id}
                            />
                            <span className={`text-xs font-medium text-center leading-tight ${isActive ? 'text-green-700' : isComplete ? 'text-green-600' : 'text-gray-500'
                                }`}>
                                {section.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Scroll Right Button */}
            {canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-gray-100 rounded-full p-1 shadow-md border border-gray-200"
                >
                    <ChevronRight size={18} className="text-green-600" />
                </button>
            )}
        </div>
    );
};

export default DesktopStepperMUI;
