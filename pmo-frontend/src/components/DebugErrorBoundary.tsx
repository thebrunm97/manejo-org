// src/components/DebugErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface DebugErrorBoundaryProps {
    children: ReactNode;
    name: string;
}

interface DebugErrorBoundaryState {
    hasError: boolean;
}

/**
 * Lightweight Error Boundary for debugging specific components
 * Shows which component failed and logs detailed error info to console
 */
class DebugErrorBoundary extends Component<DebugErrorBoundaryProps, DebugErrorBoundaryState> {
    constructor(props: DebugErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_error: Error): Partial<DebugErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.group(`🔥 DEBUG ERROR in ${this.props.name}`);
        console.error('Error:', error.toString());
        console.error('Error Stack:', error.stack);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: 20,
                        background: '#fee',
                        border: '2px solid red',
                        margin: 10,
                        borderRadius: 8
                    }}
                >
                    <h3 style={{ color: 'red', margin: '0 0 10px 0' }}>
                        ❌ Error in: {this.props.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                        Check console for detailed error information
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}

export default DebugErrorBoundary;
