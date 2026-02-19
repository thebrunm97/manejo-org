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
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-2">
            {/* Icon container */}
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                {icon || <Scale size={16} />}
            </div>

            {/* Value + Unit */}
            <div>
                <div className="text-3xl font-bold text-slate-900 leading-none tracking-tight font-['Inter']">
                    {value}
                    <span className="text-sm font-semibold text-slate-500 ml-1">
                        {unit}
                    </span>
                </div>

                {/* Extra units (e.g., "+ 30 maço") */}
                {extraUnits && (
                    <p className="text-xs text-slate-400 mt-1 block">
                        + {extraUnits}
                    </p>
                )}
            </div>

            {/* Label */}
            <p className="text-sm font-semibold text-slate-500 capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                {label}
            </p>
        </div>
    );
};

export default MetricCard;
