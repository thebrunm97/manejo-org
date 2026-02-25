// src/components/PmoForm/StepIcon.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { Check, Pencil } from 'lucide-react';

interface StepIconProps {
    active?: boolean;
    completed?: boolean;
    className?: string;
    icon?: React.ReactNode;
}

const StepIcon: React.FC<StepIconProps> = ({ active, completed, className, icon }) => {
    let bgClass = 'bg-gray-300 text-white';
    let shadowClass = '';

    if (completed) {
        bgClass = 'bg-green-600 text-white';
    } else if (active) {
        bgClass = 'bg-blue-600 text-white';
        shadowClass = 'shadow-md shadow-blue-300/50';
    }

    return (
        <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-all ${bgClass} ${shadowClass} ${className || ''}`}
        >
            {completed ? (
                <Check size={16} strokeWidth={3} />
            ) : active ? (
                <Pencil size={14} />
            ) : (
                <span className="text-xs">{icon}</span>
            )}
        </div>
    );
};

export default StepIcon;
