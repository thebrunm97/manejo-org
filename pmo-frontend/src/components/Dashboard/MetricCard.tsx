import React, { ReactNode } from 'react';
import { Scale } from 'lucide-react';

interface MetricCardProps {
    icon?: ReactNode;
    value: string;
    unit: string;
    label: string;
    extraUnits?: string | null;
}

const MetricCard: React.FC<MetricCardProps> = ({
    icon,
    value,
    unit,
    label,
    extraUnits,
}) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col gap-2 group">
            {/* Icon container */}
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-700 transition-transform group-hover:scale-110">
                {icon || <Scale size={20} />}
            </div>

            {/* Value + Unit */}
            <div className="mt-2">
                <div className="text-3xl font-black text-slate-950 leading-none tracking-tight font-sans">
                    {value}
                    <span className="text-sm font-bold text-slate-600 ml-1">
                        {unit}
                    </span>
                </div>

                {/* Extra units (e.g., "+ 30 maço") */}
                {extraUnits && (
                    <p className="text-xs text-slate-600 font-bold mt-1.5 block">
                        + {extraUnits}
                    </p>
                )}
            </div>

            {/* Label */}
            <p className="text-sm font-bold text-slate-700 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mt-1">
                {label}
            </p>
        </div>
    );
};

export default MetricCard;
