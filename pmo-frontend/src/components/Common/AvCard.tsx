import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface AvCardProps {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    noPadding?: boolean;
    className?: string;
}

const AvCard: React.FC<AvCardProps> = ({
    title,
    action,
    children,
    noPadding = false,
    className
}) => {
    return (
        <div className={cn("bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full", className)}>
            {(title || action) && (
                <div className="flex justify-between items-center px-4 py-3 min-h-[56px] border-b border-gray-100">
                    {title && (
                        <h6 className="text-sm font-semibold text-gray-900">
                            {title}
                        </h6>
                    )}
                    {action && (
                        <div>
                            {action}
                        </div>
                    )}
                </div>
            )}

            <div className={cn("flex-grow", noPadding ? "p-0" : "p-4")}>
                {children}
            </div>
        </div>
    );
};

export default AvCard;
